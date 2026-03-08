"""CRUD routers — all endpoints require authentication (Bug #4 fix)."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.models import Asset, Source, IntelItem, Entity, EntityRelationship, AlertRule, Alert
from app.models import Investigation, Case, Report, LeakItem, AuditLog, User
from app.core.deps import get_current_user, RequireRole
import json, os, uuid
from datetime import datetime, timezone

# ── Role dependency instances ──
require_read = get_current_user  # Any authenticated user can read
require_write = RequireRole("system_owner", "team_admin", "team_member")
require_admin = RequireRole("system_owner", "team_admin")
require_owner = RequireRole("system_owner")

# ── Assets Router ──
assets_router = APIRouter()

class AssetCreate(BaseModel):
    type: str
    value: str
    label: Optional[str] = None
    criticality: str = "medium"
    tags: List[str] = []
    notes: str = ""

@assets_router.get("/")
async def list_assets(type: Optional[str] = None, db: AsyncSession = Depends(get_db),
                      user=Depends(require_read)):
    q = select(Asset)
    if type: q = q.where(Asset.type == type)
    result = await db.execute(q.order_by(Asset.created_at.desc()))
    return [{"id": a.id, "type": a.type, "value": a.value, "label": a.label, "criticality": a.criticality,
             "tags": a.tags or [], "notes": a.notes, "created_at": str(a.created_at),
             "updated_at": str(a.updated_at) if a.updated_at else None} for a in result.scalars().all()]

@assets_router.post("/")
async def create_asset(req: AssetCreate, db: AsyncSession = Depends(get_db),
                       user=Depends(require_write)):
    asset = Asset(type=req.type, value=req.value, label=req.label or req.value,
                  criticality=req.criticality, tags=req.tags, notes=req.notes)
    db.add(asset)
    db.add(AuditLog(action="asset_created", entity_type="asset", user_id=user.id,
                    user_email=user.email, details={"type": req.type, "value": req.value}))
    await db.commit()
    return {"id": asset.id, "message": "Asset created"}

@assets_router.delete("/{asset_id}")
async def delete_asset(asset_id: str, db: AsyncSession = Depends(get_db),
                       user=Depends(require_admin)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset: raise HTTPException(404, "Asset not found")
    db.add(AuditLog(action="asset_deleted", entity_type="asset", entity_id=asset_id,
                    user_id=user.id, user_email=user.email))
    await db.delete(asset)
    await db.commit()
    return {"message": "Deleted"}

# ── Sources Router ──
sources_router = APIRouter()

@sources_router.get("/")
async def list_sources(db: AsyncSession = Depends(get_db), user=Depends(require_read)):
    result = await db.execute(select(Source).order_by(Source.name))
    return [{"id": s.id, "name": s.name, "category": s.category, "connector_type": s.connector_type,
             "enabled": s.enabled, "health": s.health, "item_count": s.item_count,
             "last_fetch_at": str(s.last_fetch_at) if s.last_fetch_at else None,
             "description": s.description, "default_url": s.default_url,
             "requires_auth": s.requires_auth, "polling_interval_minutes": s.polling_interval_minutes,
             } for s in result.scalars().all()]

@sources_router.post("/initialize")
async def initialize_catalog(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    catalog_path = os.path.join(os.path.dirname(__file__), "..", "..", "sources.default.json")
    with open(catalog_path) as f:
        catalog = json.load(f)
    count = 0
    for entry in catalog:
        existing = await db.execute(select(Source).where(Source.id == entry["id"]))
        if existing.scalar_one_or_none(): continue
        source = Source(**entry)
        db.add(source)
        count += 1
    await db.commit()
    return {"message": f"Initialized {count} new source templates (catalog has {len(catalog)} total)"}

@sources_router.post("/{source_id}/enable")
async def enable_source(source_id: str, resolved_url: Optional[str] = None,
                        db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source: raise HTTPException(404, "Source not found")
    source.enabled = True
    source.health = "healthy"
    if resolved_url: source.resolved_url = resolved_url
    db.add(AuditLog(action="source_enabled", entity_type="source", entity_id=source_id,
                    user_id=user.id, user_email=user.email))
    await db.commit()
    return {"message": "Source enabled"}

@sources_router.post("/{source_id}/disable")
async def disable_source(source_id: str, db: AsyncSession = Depends(get_db),
                         user=Depends(require_admin)):
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source: raise HTTPException(404, "Source not found")
    source.enabled = False
    source.health = "disabled"
    db.add(AuditLog(action="source_disabled", entity_type="source", entity_id=source_id,
                    user_id=user.id, user_email=user.email))
    await db.commit()
    return {"message": "Source disabled"}

# ── Feed Router ──
feed_router = APIRouter()

@feed_router.get("/")
async def list_feed(severity: Optional[str] = None, source_id: Optional[str] = None,
                    observable_type: Optional[str] = None, asset_match_only: bool = False,
                    offset: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db),
                    user=Depends(require_read)):
    q = select(IntelItem)
    if severity: q = q.where(IntelItem.severity == severity)
    if source_id: q = q.where(IntelItem.source_id == source_id)
    if observable_type: q = q.where(IntelItem.observable_type == observable_type)
    if asset_match_only: q = q.where(IntelItem.asset_match == True)
    q = q.order_by(IntelItem.fetched_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    return [{"id": i.id, "title": i.title, "severity": i.severity,
             "observable_type": i.observable_type, "observable_value": i.observable_value,
             "source_name": i.source_name, "asset_match": i.asset_match,
             "dedup_count": i.dedup_count, "confidence_score": i.confidence_score, "risk_score": i.risk_score,
             "published_at": str(i.published_at) if i.published_at else None,
             "original_url": i.original_url, "excerpt": i.excerpt,
             "source_id": i.source_id, "fetched_at": str(i.fetched_at),
             "description": i.description or "", "tags": i.tags or [],
             "matched_assets": i.matched_asset_ids or []} for i in result.scalars().all()]

# ── Search Router ──
search_router = APIRouter()

@search_router.get("/")
async def search(q: str = Query(..., min_length=1), offset: int = 0, limit: int = 30,
                 db: AsyncSession = Depends(get_db), user=Depends(require_read)):
    ts_query = func.plainto_tsquery("english", q)
    result = await db.execute(
        select(IntelItem).where(IntelItem.search_vector.op("@@")(ts_query))
        .order_by(func.ts_rank(IntelItem.search_vector, ts_query).desc())
        .offset(offset).limit(limit)
    )
    items = result.scalars().all()
    entity_result = await db.execute(
        select(Entity).where(Entity.search_vector.op("@@")(ts_query))
        .order_by(func.ts_rank(Entity.search_vector, ts_query).desc())
        .limit(20)
    )
    entities = entity_result.scalars().all()
    return {
        "intel_items": [{"id": i.id, "title": i.title, "severity": i.severity,
                         "type": i.observable_type} for i in items],
        "entities": [{"id": e.id, "name": e.name, "type": e.type} for e in entities],
        "total": len(items) + len(entities),
    }

# ── Entities Router ──
entities_router = APIRouter()

@entities_router.get("/")
async def list_entities(type: Optional[str] = None, offset: int = 0, limit: int = 50,
                        db: AsyncSession = Depends(get_db), user=Depends(require_read)):
    q = select(Entity)
    if type: q = q.where(Entity.type == type)
    result = await db.execute(q.order_by(Entity.last_seen.desc()).offset(offset).limit(limit))
    return [{"id": e.id, "type": e.type, "name": e.name, "confidence": e.confidence,
             "first_seen": str(e.first_seen) if e.first_seen else None} for e in result.scalars().all()]

@entities_router.get("/{entity_id}/relationships")
async def get_relationships(entity_id: str, db: AsyncSession = Depends(get_db),
                            user=Depends(require_read)):
    result = await db.execute(
        select(EntityRelationship).where(
            (EntityRelationship.source_entity_id == entity_id) | (EntityRelationship.target_entity_id == entity_id)
        )
    )
    return [{"id": r.id, "source": r.source_entity_id, "target": r.target_entity_id,
             "type": r.relationship_type, "confidence": r.confidence} for r in result.scalars().all()]

# ── Alerts Router ──
alerts_router = APIRouter()

@alerts_router.get("/rules")
async def list_rules(db: AsyncSession = Depends(get_db), user=Depends(require_read)):
    result = await db.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))
    return [{"id": r.id, "name": r.name, "severity": r.severity, "enabled": r.enabled,
             "conditions": r.conditions, "trigger_count": r.trigger_count} for r in result.scalars().all()]

@alerts_router.post("/rules")
async def create_rule(name: str, description: str, severity: str, conditions: list,
                      db: AsyncSession = Depends(get_db), user=Depends(require_write)):
    rule = AlertRule(name=name, description=description, severity=severity,
                     conditions=conditions, created_by=user.id)
    db.add(rule)
    db.add(AuditLog(action="alert_rule_created", entity_type="alert_rule",
                    user_id=user.id, user_email=user.email, details={"name": name, "severity": severity}))
    await db.commit()
    return {"id": rule.id}

@alerts_router.get("/")
async def list_alerts(status: Optional[str] = None, db: AsyncSession = Depends(get_db),
                      user=Depends(require_read)):
    q = select(Alert)
    if status: q = q.where(Alert.status == status)
    result = await db.execute(q.order_by(Alert.triggered_at.desc()))
    return [{"id": a.id, "rule_id": a.rule_id, "severity": a.severity, "status": a.status,
             "triggered_at": str(a.triggered_at), "notes": a.notes} for a in result.scalars().all()]

# ── Cases Router ──
cases_router = APIRouter()

@cases_router.get("/")
async def list_cases(db: AsyncSession = Depends(get_db), user=Depends(require_read)):
    result = await db.execute(select(Case).order_by(Case.created_at.desc()))
    return [{"id": c.id, "title": c.title, "status": c.status, "priority": c.priority,
             "created_at": str(c.created_at)} for c in result.scalars().all()]

@cases_router.post("/")
async def create_case(title: str, description: str, priority: str = "medium",
                      db: AsyncSession = Depends(get_db), user=Depends(require_write)):
    case = Case(title=title, description=description, priority=priority, created_by=user.id)
    db.add(case)
    db.add(AuditLog(action="case_created", entity_type="case",
                    user_id=user.id, user_email=user.email, details={"title": title}))
    await db.commit()
    return {"id": case.id}

# ── Reports Router ──
reports_router = APIRouter()

@reports_router.get("/")
async def list_reports(db: AsyncSession = Depends(get_db), user=Depends(require_read)):
    result = await db.execute(select(Report).order_by(Report.generated_at.desc()))
    return [{"id": r.id, "title": r.title, "format": r.format,
             "generated_at": str(r.generated_at)} for r in result.scalars().all()]

@reports_router.post("/generate")
async def generate_report(case_id: str, format: str = "technical_pdf",
                          db: AsyncSession = Depends(get_db), user=Depends(require_write)):
    report = Report(title=f"Report for case {case_id}", case_id=case_id,
                    format=format, generated_by=user.id)
    db.add(report)
    db.add(AuditLog(action="report_generated", entity_type="report",
                    user_id=user.id, user_email=user.email, details={"case_id": case_id, "format": format}))
    await db.commit()
    return {"id": report.id, "message": "Report generation queued"}

# ── Leaks Router ──
leaks_router = APIRouter()

@leaks_router.get("/")
async def list_leaks(type: Optional[str] = None, asset_match_only: bool = False,
                     db: AsyncSession = Depends(get_db), user=Depends(require_read)):
    q = select(LeakItem)
    if type: q = q.where(LeakItem.type == type)
    if asset_match_only: q = q.where(func.array_length(LeakItem.matched_asset_ids, 1) > 0)
    result = await db.execute(q.order_by(LeakItem.discovered_at.desc()))
    return [{"id": l.id, "type": l.type, "title": l.title, "severity": l.severity,
             "source_name": l.source_name, "is_tor_source": l.is_tor_source,
             "evidence_excerpt": l.evidence_excerpt} for l in result.scalars().all()]

# ── Admin Router ──
admin_router = APIRouter()

@admin_router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [{"id": u.id, "email": u.email, "name": u.name, "role": u.role,
             "is_active": u.is_active, "created_at": str(u.created_at)} for u in result.scalars().all()]

@admin_router.get("/audit-logs")
async def list_audit_logs(action: Optional[str] = None, limit: int = 100,
                          db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    q = select(AuditLog)
    if action: q = q.where(AuditLog.action == action)
    result = await db.execute(q.order_by(AuditLog.timestamp.desc()).limit(limit))
    return [{"id": a.id, "action": a.action, "entity_type": a.entity_type,
             "user_email": a.user_email, "timestamp": str(a.timestamp),
             "details": a.details} for a in result.scalars().all()]

# ── Health Router ──
health_router = APIRouter()

@health_router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check — verifies DB connectivity."""
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok" if db_status == "connected" else "degraded",
            "service": "catshy-api", "version": "1.0.0", "database": db_status}
