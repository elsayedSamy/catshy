"""Celery application and tasks for background workers"""
from celery import Celery
from celery.schedules import crontab
import os

app = Celery("catshy",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2"),
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "poll-enabled-sources": {
            "task": "app.tasks.polling.poll_all_enabled_sources",
            "schedule": 60.0,  # Check every minute, per-source intervals managed inside
        },
        "evaluate-alert-rules": {
            "task": "app.tasks.alerting.evaluate_all_rules",
            "schedule": 120.0,
        },
        "health-check-sources": {
            "task": "app.tasks.polling.health_check_sources",
            "schedule": 300.0,
        },
    },
)

# ── Polling Tasks ──
@app.task(name="app.tasks.polling.poll_all_enabled_sources")
def poll_all_enabled_sources():
    """Poll all enabled sources that are due for a fetch (respecting intervals and backoff)"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models import Source
    from datetime import datetime, timedelta
    import os
    engine = create_engine(os.getenv("DATABASE_URL_SYNC", "postgresql://catshy:catshy_secret@localhost:5432/catshy"))
    with Session(engine) as db:
        sources = db.query(Source).filter(Source.enabled == True).all()
        for source in sources:
            if source.backoff_until and source.backoff_until > datetime.utcnow():
                continue
            if source.last_fetch_at:
                next_fetch = source.last_fetch_at + timedelta(minutes=source.polling_interval_minutes)
                if datetime.utcnow() < next_fetch:
                    continue
            poll_single_source.delay(source.id)

@app.task(name="app.tasks.polling.poll_single_source", bind=True, max_retries=2)
def poll_single_source(self, source_id: str):
    """Fetch and normalize intel from a single source"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models import Source, IntelItem
    from app.services.ssrf_protection import validate_url, SSRFError
    from datetime import datetime
    import httpx, feedparser, hashlib, os
    engine = create_engine(os.getenv("DATABASE_URL_SYNC", "postgresql://catshy:catshy_secret@localhost:5432/catshy"))
    with Session(engine) as db:
        source = db.query(Source).filter(Source.id == source_id).first()
        if not source or not source.enabled: return
        url = source.resolved_url or source.default_url
        try:
            validate_url(url)
            response = httpx.get(url, timeout=15, follow_redirects=True)
            response.raise_for_status()
            # Parse based on connector type
            items = []
            if source.connector_type in ("rss_atom",):
                feed = feedparser.parse(response.text)
                for entry in feed.entries[:100]:
                    title = getattr(entry, "title", "Untitled")
                    link = getattr(entry, "link", "")
                    desc = getattr(entry, "summary", "")[:1000]
                    dedup = hashlib.sha256(f"{source.id}:{link}:{title}".encode()).hexdigest()
                    existing = db.query(IntelItem).filter(IntelItem.dedup_hash == dedup).first()
                    if existing:
                        existing.dedup_count += 1
                        continue
                    item = IntelItem(
                        title=title, description=desc, severity="info",
                        observable_type="other", observable_value=link,
                        canonical_value=link, source_id=source.id,
                        source_name=source.name, original_url=link,
                        excerpt=desc[:500], dedup_hash=dedup,
                        published_at=datetime.utcnow(), fetched_at=datetime.utcnow()
                    )
                    items.append(item)
            elif source.connector_type in ("http_json", "rest_api"):
                # Generic JSON handling
                data = response.json()
                entries = data if isinstance(data, list) else data.get("vulnerabilities", data.get("data", data.get("results", [])))
                if isinstance(entries, list):
                    for entry in entries[:200]:
                        title = str(entry.get("title", entry.get("cveId", entry.get("id", "Unknown"))))[:500]
                        dedup = hashlib.sha256(f"{source.id}:{title}".encode()).hexdigest()
                        if db.query(IntelItem).filter(IntelItem.dedup_hash == dedup).first(): continue
                        item = IntelItem(
                            title=title, description=str(entry)[:1000], severity="info",
                            observable_type="other", observable_value=title,
                            canonical_value=title, source_id=source.id,
                            source_name=source.name, original_url=url,
                            excerpt=str(entry)[:500], dedup_hash=dedup,
                            fetched_at=datetime.utcnow(), raw_data=entry if isinstance(entry, dict) else {}
                        )
                        items.append(item)
            elif source.connector_type in ("http_csv",):
                lines = response.text.strip().split("\n")
                for line in lines[:500]:
                    if line.startswith("#") or line.startswith(";"): continue
                    dedup = hashlib.sha256(f"{source.id}:{line[:200]}".encode()).hexdigest()
                    if db.query(IntelItem).filter(IntelItem.dedup_hash == dedup).first(): continue
                    item = IntelItem(
                        title=line[:200], description=line, severity="info",
                        observable_type="other", observable_value=line.split(",")[0] if "," in line else line[:100],
                        canonical_value=line[:100], source_id=source.id,
                        source_name=source.name, original_url=url,
                        excerpt=line[:500], dedup_hash=dedup, fetched_at=datetime.utcnow()
                    )
                    items.append(item)
            db.add_all(items)
            source.last_fetch_at = datetime.utcnow()
            source.item_count += len(items)
            source.health = "healthy"
            source.consecutive_failures = 0
            source.last_error = None
            db.commit()
        except SSRFError as e:
            source.health = "error"
            source.last_error = f"SSRF blocked: {e}"
            db.commit()
        except httpx.HTTPStatusError as e:
            source.consecutive_failures += 1
            if e.response.status_code in (429, 403):
                source.health = "degraded"
                from datetime import timedelta
                backoff = min(60 * (2 ** source.consecutive_failures), 1440)
                source.backoff_until = datetime.utcnow() + timedelta(minutes=backoff)
            else:
                source.health = "error"
            source.last_error = str(e)[:500]
            db.commit()
        except Exception as e:
            source.health = "error"
            source.consecutive_failures += 1
            source.last_error = str(e)[:500]
            db.commit()

@app.task(name="app.tasks.polling.health_check_sources")
def health_check_sources():
    """Check health of all enabled sources"""
    pass  # Implemented via poll with lightweight HEAD requests

# ── Alerting Tasks ──
@app.task(name="app.tasks.alerting.evaluate_all_rules")
def evaluate_all_rules():
    """Evaluate all enabled alert rules against recent intel"""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models import AlertRule, Alert, IntelItem
    from datetime import datetime, timedelta
    import os, json
    engine = create_engine(os.getenv("DATABASE_URL_SYNC", "postgresql://catshy:catshy_secret@localhost:5432/catshy"))
    with Session(engine) as db:
        rules = db.query(AlertRule).filter(AlertRule.enabled == True).all()
        recent_cutoff = datetime.utcnow() - timedelta(minutes=5)
        recent_items = db.query(IntelItem).filter(IntelItem.fetched_at >= recent_cutoff).all()
        for rule in rules:
            matched = []
            for item in recent_items:
                if _item_matches_rule(item, rule.conditions):
                    matched.append(item.id)
            if matched:
                alert = Alert(rule_id=rule.id, severity=rule.severity, matched_items=matched)
                db.add(alert)
                rule.trigger_count += 1
                rule.last_triggered_at = datetime.utcnow()
        db.commit()

def _item_matches_rule(item, conditions):
    for cond in conditions:
        field_val = getattr(item, cond.get("field", ""), "")
        op = cond.get("operator", "contains")
        val = cond.get("value", "")
        if op == "equals" and str(field_val) != val: return False
        if op == "contains" and val.lower() not in str(field_val).lower(): return False
        if op == "regex":
            import re
            if not re.search(val, str(field_val), re.IGNORECASE): return False
    return True
