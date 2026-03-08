"""Celery application and tasks for background workers.

Phase 2 fix: IngestionPipeline is async (uses AsyncSession).  Celery tasks are
synchronous.  We bridge the gap with ``asyncio.run()`` and a dedicated
``AsyncSession`` created per-task.  The sync session is kept only for cheap
ORM lookups that don't touch the pipeline.
"""
from celery import Celery
import asyncio
import os
import logging

logger = logging.getLogger("catshy.celery")

app = Celery(
    "catshy",
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
            "schedule": 60.0,
        },
        "evaluate-alert-rules": {
            "task": "app.tasks.alerting.evaluate_all_rules",
            "schedule": 120.0,
        },
        "health-check-sources": {
            "task": "app.tasks.polling.health_check_sources",
            "schedule": 300.0,
        },
        "cleanup-old-intel": {
            "task": "app.tasks.retention.cleanup_old_intel_items",
            "schedule": 3600.0,
        },
    },
)


# ── Session helpers ──────────────────────────────────────────────────────────

def _get_sync_session():
    """Return (engine, session) for lightweight sync queries."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    url = os.getenv("DATABASE_URL_SYNC", "postgresql://catshy:catshy_secret@localhost:5432/catshy")
    engine = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=2)
    return engine, Session(engine)


def _get_async_engine():
    """Create a standalone async engine for Celery task context.

    We do NOT reuse the FastAPI engine because Celery workers live in a
    different process and the event-loop is created per-task via asyncio.run().
    """
    from sqlalchemy.ext.asyncio import create_async_engine

    url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://catshy:catshy_secret@localhost:5432/catshy",
    )
    return create_async_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=2)


# ── Polling Tasks ────────────────────────────────────────────────────────────

@app.task(name="app.tasks.polling.poll_all_enabled_sources")
def poll_all_enabled_sources():
    """Poll all enabled sources that are due for a fetch."""
    from app.models import Source
    from datetime import datetime, timezone, timedelta

    engine, db = _get_sync_session()
    now = datetime.now(timezone.utc)
    try:
        sources = db.query(Source).filter(Source.enabled == True).all()
        for source in sources:
            if source.backoff_until and source.backoff_until > now:
                continue
            if source.last_fetch_at:
                next_fetch = source.last_fetch_at + timedelta(minutes=source.polling_interval_minutes)
                if now < next_fetch:
                    continue
            poll_single_source.delay(source.id)
    finally:
        db.close()
        engine.dispose()


@app.task(name="app.tasks.polling.poll_single_source", bind=True, max_retries=2)
def poll_single_source(self, source_id: str):
    """Fetch and ingest intel from a single source using the async pipeline."""
    try:
        asyncio.run(_poll_single_source_async(source_id))
    except Exception:
        logger.exception(f"poll_single_source({source_id}) failed")
        raise


async def _poll_single_source_async(source_id: str):
    """Async implementation: fetch raw entries, run IngestionPipeline, commit."""
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select
    from app.models import Source
    from app.services.ssrf_protection import validate_url, SSRFError
    from app.services.ingestion import IngestionPipeline
    from datetime import datetime, timezone, timedelta
    import httpx
    import feedparser

    async_engine = _get_async_engine()

    async with AsyncSession(async_engine, expire_on_commit=False) as db:
        try:
            result = await db.execute(select(Source).where(Source.id == source_id))
            source = result.scalar_one_or_none()
            if not source or not source.enabled:
                return

            url = source.resolved_url or source.default_url
            try:
                validate_url(url)
            except SSRFError as e:
                source.health = "error"
                source.last_error = f"SSRF blocked: {e}"
                await db.commit()
                return

            # Fetch raw data (httpx is sync here — fine for a worker)
            try:
                async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                    response = await client.get(url)
                    response.raise_for_status()
            except httpx.HTTPStatusError as e:
                source.consecutive_failures = (source.consecutive_failures or 0) + 1
                now = datetime.now(timezone.utc)
                if e.response.status_code in (429, 403):
                    source.health = "degraded"
                    backoff = min(60 * (2 ** source.consecutive_failures), 1440)
                    source.backoff_until = now + timedelta(minutes=backoff)
                else:
                    source.health = "error"
                source.last_error = str(e)[:500]
                await db.commit()
                return
            except Exception as e:
                source.health = "error"
                source.consecutive_failures = (source.consecutive_failures or 0) + 1
                source.last_error = str(e)[:500]
                await db.commit()
                return

            # Parse raw entries based on connector type
            now = datetime.now(timezone.utc)
            raw_entries = []

            if source.connector_type in ("rss_atom",):
                feed = feedparser.parse(response.text)
                for entry in feed.entries[:100]:
                    raw_entries.append({
                        "title": getattr(entry, "title", "Untitled"),
                        "link": getattr(entry, "link", ""),
                        "description": getattr(entry, "summary", "")[:1000],
                        "published_at": now,
                    })
            elif source.connector_type in ("http_json", "rest_api"):
                data = response.json()
                entries = data if isinstance(data, list) else data.get(
                    "vulnerabilities", data.get("data", data.get("results", []))
                )
                if isinstance(entries, list):
                    for entry in entries[:200]:
                        raw_entries.append({
                            "title": str(
                                entry.get("title", entry.get("cveId", entry.get("id", "Unknown")))
                            )[:500],
                            "description": str(entry)[:1000],
                            "link": url,
                            "raw": entry if isinstance(entry, dict) else {},
                        })
            elif source.connector_type in ("http_csv",):
                lines = response.text.strip().split("\n")
                for line in lines[:500]:
                    if line.startswith("#") or line.startswith(";"):
                        continue
                    raw_entries.append({
                        "title": line[:200],
                        "description": line,
                        "link": url,
                    })

            # Run async ingestion pipeline
            pipeline = IngestionPipeline(db, source, workspace_id=source.workspace_id)
            created = await pipeline.process_entries(raw_entries)
            await db.commit()

            logger.info(
                f"Source {source.name}: fetched={len(raw_entries)}, "
                f"new={len(created)}, dedup={pipeline.stats['items_deduplicated']}"
            )

        except Exception:
            await db.rollback()
            logger.exception(f"Pipeline failed for source {source_id}")
            raise

    # Dispose of the per-task engine to avoid connection leaks
    await async_engine.dispose()


@app.task(name="app.tasks.polling.health_check_sources")
def health_check_sources():
    """Check health of all enabled sources."""
    pass


# ── Retention Cleanup ────────────────────────────────────────────────────────

@app.task(name="app.tasks.retention.cleanup_old_intel_items")
def cleanup_old_intel_items():
    """Delete intel items older than 30 days (retention policy)."""
    from sqlalchemy import func
    from app.models import IntelItem
    from datetime import datetime, timezone, timedelta

    engine, db = _get_sync_session()
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    try:
        deleted = db.query(IntelItem).filter(
            func.coalesce(IntelItem.published_at, IntelItem.fetched_at) < cutoff
        ).delete(synchronize_session=False)
        db.commit()
        logger.info(f"Retention cleanup: deleted {deleted} intel items older than 30 days")
    finally:
        db.close()
        engine.dispose()
    return {"deleted": deleted}


# ── Alerting Tasks ───────────────────────────────────────────────────────────

@app.task(name="app.tasks.alerting.evaluate_all_rules")
def evaluate_all_rules():
    """Evaluate all enabled alert rules against recent intel (workspace-scoped)."""
    from app.models import AlertRule, Alert, IntelItem
    from datetime import datetime, timezone, timedelta

    engine, db = _get_sync_session()
    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(minutes=5)

    try:
        rules = db.query(AlertRule).filter(AlertRule.enabled == True).all()

        for rule in rules:
            # Scope recent items to the rule's workspace
            recent_items = db.query(IntelItem).filter(
                IntelItem.fetched_at >= recent_cutoff,
                IntelItem.workspace_id == rule.workspace_id,
            ).all()

            matched = []
            for item in recent_items:
                if _item_matches_rule(item, rule.conditions):
                    matched.append(item.id)

            if matched:
                alert = Alert(
                    rule_id=rule.id,
                    severity=rule.severity,
                    matched_items=matched,
                    workspace_id=rule.workspace_id,
                )
                db.add(alert)
                rule.trigger_count = (rule.trigger_count or 0) + 1
                rule.last_triggered_at = now

        db.commit()
    finally:
        db.close()
        engine.dispose()


def _item_matches_rule(item, conditions):
    import re as re_mod

    for cond in conditions:
        field_val = getattr(item, cond.get("field", ""), "")
        op = cond.get("operator", "contains")
        val = cond.get("value", "")
        if op == "equals" and str(field_val) != val:
            return False
        if op == "contains" and val.lower() not in str(field_val).lower():
            return False
        if op == "regex":
            if not re_mod.search(val, str(field_val), re_mod.IGNORECASE):
                return False
    return True
