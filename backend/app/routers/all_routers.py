"""CRUD routers — all endpoints require authentication + workspace scoping."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.models import Asset, Source, IntelItem, Entity, EntityRelationship, AlertRule, Alert
from app.models import Investigation, Case, Report, LeakItem, AuditLog, User
from app.core.deps import get_current_user, get_workspace_id, RequireRole
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
async def list_assets(type: Optional[str] = None, offset: int = 0, limit: int = Query(50, le=200),
                      db: AsyncSession = Depends(get_db),
                      user=Depends(require_read), wid: str = Depends(get_workspace_id)):
    q = select(Asset).where(Asset.workspace_id == wid)
    if type: q = q.where(Asset.type == type)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Asset.created_at.desc()).offset(offset).limit(limit))
    items = [{"id": a.id, "type": a.type, "value": a.value, "label": a.label, "criticality": a.criticality,
             "tags": a.tags or [], "notes": a.notes, "created_at": str(a.created_at),
             "updated_at": str(a.updated_at) if a.updated_at else None} for a in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@assets_router.post("/")
async def create_asset(req: AssetCreate, db: AsyncSession = Depends(get_db),
                       user=Depends(require_write), wid: str = Depends(get_workspace_id)):
    asset = Asset(workspace_id=wid, type=req.type, value=req.value, label=req.label or req.value,
                  criticality=req.criticality, tags=req.tags, notes=req.notes)
    db.add(asset)
    db.add(AuditLog(action="asset_created", entity_type="asset", user_id=user.id,
                    user_email=user.email, workspace_id=wid,
                    details={"type": req.type, "value": req.value}))
    await db.commit()
    return {"id": asset.id, "message": "Asset created"}

@assets_router.delete("/{asset_id}")
async def delete_asset(asset_id: str, db: AsyncSession = Depends(get_db),
                       user=Depends(require_admin), wid: str = Depends(get_workspace_id)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id, Asset.workspace_id == wid))
    asset = result.scalar_one_or_none()
    if not asset: raise HTTPException(404, "Asset not found")
    db.add(AuditLog(action="asset_deleted", entity_type="asset", entity_id=asset_id,
                    user_id=user.id, user_email=user.email, workspace_id=wid))
    await db.delete(asset)
    await db.commit()
    return {"message": "Deleted"}

# ── Sources Router ──
sources_router = APIRouter()

@sources_router.get("/")
async def list_sources(offset: int = 0, limit: int = Query(50, le=200),
                       db: AsyncSession = Depends(get_db), user=Depends(require_read),
                       wid: str = Depends(get_workspace_id)):
    q = select(Source).where(Source.workspace_id == wid)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Source.name).offset(offset).limit(limit))
    items = [{"id": s.id, "name": s.name, "category": s.category, "connector_type": s.connector_type,
             "enabled": s.enabled, "health": s.health, "item_count": s.item_count,
             "last_fetch_at": str(s.last_fetch_at) if s.last_fetch_at else None,
             "description": s.description, "default_url": s.default_url,
             "requires_auth": s.requires_auth, "polling_interval_minutes": s.polling_interval_minutes,
             } for s in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@sources_router.post("/initialize")
async def initialize_catalog(db: AsyncSession = Depends(get_db), user=Depends(require_admin),
                             wid: str = Depends(get_workspace_id)):
    catalog_path = os.path.join(os.path.dirname(__file__), "..", "..", "sources.default.json")
    with open(catalog_path) as f:
        catalog = json.load(f)
    count = 0
    for entry in catalog:
        # Check existence within this workspace
        existing = await db.execute(
            select(Source).where(Source.id == entry["id"], Source.workspace_id == wid))
        if existing.scalar_one_or_none(): continue
        source = Source(**entry, workspace_id=wid)
        db.add(source)
        count += 1
    await db.commit()
    return {"message": f"Initialized {count} new source templates (catalog has {len(catalog)} total)"}

@sources_router.post("/{source_id}/enable")
async def enable_source(source_id: str, resolved_url: Optional[str] = None,
                        db: AsyncSession = Depends(get_db), user=Depends(require_admin),
                        wid: str = Depends(get_workspace_id)):
    result = await db.execute(select(Source).where(Source.id == source_id, Source.workspace_id == wid))
    source = result.scalar_one_or_none()
    if not source: raise HTTPException(404, "Source not found")
    source.enabled = True
    source.health = "healthy"
    if resolved_url: source.resolved_url = resolved_url
    db.add(AuditLog(action="source_enabled", entity_type="source", entity_id=source_id,
                    user_id=user.id, user_email=user.email, workspace_id=wid))
    await db.commit()
    return {"message": "Source enabled"}

@sources_router.post("/{source_id}/disable")
async def disable_source(source_id: str, db: AsyncSession = Depends(get_db),
                         user=Depends(require_admin), wid: str = Depends(get_workspace_id)):
    result = await db.execute(select(Source).where(Source.id == source_id, Source.workspace_id == wid))
    source = result.scalar_one_or_none()
    if not source: raise HTTPException(404, "Source not found")
    source.enabled = False
    source.health = "disabled"
    db.add(AuditLog(action="source_disabled", entity_type="source", entity_id=source_id,
                    user_id=user.id, user_email=user.email, workspace_id=wid))
    await db.commit()
    return {"message": "Source disabled"}


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_url: Optional[str] = None
    resolved_url: Optional[str] = None
    polling_interval_minutes: Optional[int] = None
    category: Optional[str] = None
    connector_type: Optional[str] = None


@sources_router.put("/{source_id}")
async def update_source(source_id: str, req: SourceUpdate, db: AsyncSession = Depends(get_db),
                        user=Depends(require_admin), wid: str = Depends(get_workspace_id)):
    result = await db.execute(select(Source).where(Source.id == source_id, Source.workspace_id == wid))
    source = result.scalar_one_or_none()
    if not source: raise HTTPException(404, "Source not found")
    if req.name is not None: source.name = req.name
    if req.description is not None: source.description = req.description
    if req.default_url is not None: source.default_url = req.default_url
    if req.resolved_url is not None: source.resolved_url = req.resolved_url
    if req.polling_interval_minutes is not None: source.polling_interval_minutes = req.polling_interval_minutes
    if req.category is not None: source.category = req.category
    if req.connector_type is not None: source.connector_type = req.connector_type
    db.add(AuditLog(action="source_updated", entity_type="source", entity_id=source_id,
                    user_id=user.id, user_email=user.email, workspace_id=wid,
                    details={"name": source.name}))
    await db.commit()
    return {"message": "Source updated"}


@sources_router.delete("/{source_id}")
async def delete_source(source_id: str, db: AsyncSession = Depends(get_db),
                        user=Depends(require_admin), wid: str = Depends(get_workspace_id)):
    result = await db.execute(select(Source).where(Source.id == source_id, Source.workspace_id == wid))
    source = result.scalar_one_or_none()
    if not source: raise HTTPException(404, "Source not found")
    db.add(AuditLog(action="source_deleted", entity_type="source", entity_id=source_id,
                    user_id=user.id, user_email=user.email, workspace_id=wid,
                    details={"name": source.name}))
    await db.delete(source)
    await db.commit()
    return {"message": "Source deleted"}

# ── Feed Router ──
feed_router = APIRouter()

@feed_router.get("/")
async def list_feed(severity: Optional[str] = None, source_id: Optional[str] = None,
                    observable_type: Optional[str] = None, asset_match_only: bool = False,
                    offset: int = 0, limit: int = Query(50, le=200),
                    db: AsyncSession = Depends(get_db),
                    user=Depends(require_read), wid: str = Depends(get_workspace_id)):
    q = select(IntelItem).where(IntelItem.workspace_id == wid)
    if severity: q = q.where(IntelItem.severity == severity)
    if source_id: q = q.where(IntelItem.source_id == source_id)
    if observable_type: q = q.where(IntelItem.observable_type == observable_type)
    if asset_match_only: q = q.where(IntelItem.asset_match == True)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(IntelItem.fetched_at.desc()).offset(offset).limit(limit)
    result = await db.execute(q)
    items = [{"id": i.id, "title": i.title, "severity": i.severity,
             "observable_type": i.observable_type, "observable_value": i.observable_value,
             "source_name": i.source_name, "asset_match": i.asset_match,
             "dedup_count": i.dedup_count, "confidence_score": i.confidence_score, "risk_score": i.risk_score,
             "published_at": str(i.published_at) if i.published_at else None,
             "original_url": i.original_url, "excerpt": i.excerpt,
             "source_id": i.source_id, "fetched_at": str(i.fetched_at),
             "description": i.description or "", "tags": i.tags or [],
             "matched_assets": i.matched_asset_ids or []} for i in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

# ── Search Router ──
search_router = APIRouter()

@search_router.get("/")
async def search(q: str = Query(..., min_length=1), offset: int = 0, limit: int = Query(30, le=100),
                 db: AsyncSession = Depends(get_db), user=Depends(require_read),
                 wid: str = Depends(get_workspace_id)):
    ts_query = func.plainto_tsquery("english", q)
    intel_q = (
        select(IntelItem)
        .where(IntelItem.workspace_id == wid, IntelItem.search_vector.op("@@")(ts_query))
        .order_by(func.ts_rank(IntelItem.search_vector, ts_query).desc())
        .offset(offset).limit(limit)
    )
    result = await db.execute(intel_q)
    items = result.scalars().all()

    entity_q = (
        select(Entity)
        .where(Entity.workspace_id == wid, Entity.search_vector.op("@@")(ts_query))
        .order_by(func.ts_rank(Entity.search_vector, ts_query).desc())
        .limit(20)
    )
    entity_result = await db.execute(entity_q)
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
async def list_entities(type: Optional[str] = None, offset: int = 0, limit: int = Query(50, le=200),
                        db: AsyncSession = Depends(get_db), user=Depends(require_read),
                        wid: str = Depends(get_workspace_id)):
    q = select(Entity).where(Entity.workspace_id == wid)
    if type: q = q.where(Entity.type == type)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Entity.last_seen.desc()).offset(offset).limit(limit))
    items = [{"id": e.id, "type": e.type, "name": e.name, "confidence": e.confidence,
             "first_seen": str(e.first_seen) if e.first_seen else None} for e in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@entities_router.get("/{entity_id}/relationships")
async def get_relationships(entity_id: str, db: AsyncSession = Depends(get_db),
                            user=Depends(require_read), wid: str = Depends(get_workspace_id)):
    # Verify entity belongs to workspace
    entity_check = await db.execute(
        select(Entity).where(Entity.id == entity_id, Entity.workspace_id == wid))
    if not entity_check.scalar_one_or_none():
        raise HTTPException(404, "Entity not found")
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
async def list_rules(offset: int = 0, limit: int = Query(50, le=200),
                     db: AsyncSession = Depends(get_db), user=Depends(require_read),
                     wid: str = Depends(get_workspace_id)):
    q = select(AlertRule).where(AlertRule.workspace_id == wid)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(AlertRule.created_at.desc()).offset(offset).limit(limit))
    items = [{"id": r.id, "name": r.name, "severity": r.severity, "enabled": r.enabled,
             "conditions": r.conditions, "trigger_count": r.trigger_count} for r in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@alerts_router.post("/rules")
async def create_rule(name: str, description: str, severity: str, conditions: list,
                      db: AsyncSession = Depends(get_db), user=Depends(require_write),
                      wid: str = Depends(get_workspace_id)):
    rule = AlertRule(workspace_id=wid, name=name, description=description, severity=severity,
                     conditions=conditions, created_by=user.id)
    db.add(rule)
    db.add(AuditLog(action="alert_rule_created", entity_type="alert_rule",
                    user_id=user.id, user_email=user.email, workspace_id=wid,
                    details={"name": name, "severity": severity}))
    await db.commit()
    return {"id": rule.id}

@alerts_router.get("/")
async def list_alerts(status: Optional[str] = None, offset: int = 0, limit: int = Query(50, le=200),
                      db: AsyncSession = Depends(get_db),
                      user=Depends(require_read), wid: str = Depends(get_workspace_id)):
    q = select(Alert).where(Alert.workspace_id == wid)
    if status: q = q.where(Alert.status == status)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Alert.triggered_at.desc()).offset(offset).limit(limit))
    items = [{"id": a.id, "rule_id": a.rule_id, "severity": a.severity, "status": a.status,
             "triggered_at": str(a.triggered_at), "notes": a.notes} for a in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

# ── Cases Router ──
cases_router = APIRouter()

@cases_router.get("/")
async def list_cases(offset: int = 0, limit: int = Query(50, le=200),
                     db: AsyncSession = Depends(get_db), user=Depends(require_read),
                     wid: str = Depends(get_workspace_id)):
    q = select(Case).where(Case.workspace_id == wid)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Case.created_at.desc()).offset(offset).limit(limit))
    items = [{"id": c.id, "title": c.title, "status": c.status, "priority": c.priority,
             "created_at": str(c.created_at)} for c in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@cases_router.post("/")
async def create_case(title: str, description: str, priority: str = "medium",
                      db: AsyncSession = Depends(get_db), user=Depends(require_write),
                      wid: str = Depends(get_workspace_id)):
    case = Case(workspace_id=wid, title=title, description=description, priority=priority, created_by=user.id)
    db.add(case)
    db.add(AuditLog(action="case_created", entity_type="case",
                    user_id=user.id, user_email=user.email, workspace_id=wid,
                    details={"title": title}))
    await db.commit()
    return {"id": case.id}

# ── Reports Router ──
reports_router = APIRouter()

@reports_router.get("/")
async def list_reports(offset: int = 0, limit: int = Query(50, le=200),
                       db: AsyncSession = Depends(get_db), user=Depends(require_read),
                       wid: str = Depends(get_workspace_id)):
    q = select(Report).where(Report.workspace_id == wid)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(Report.generated_at.desc()).offset(offset).limit(limit))
    items = [{"id": r.id, "title": r.title, "format": r.format,
             "generated_at": str(r.generated_at)} for r in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@reports_router.post("/generate")
async def generate_report(case_id: str, format: str = "technical_pdf",
                          db: AsyncSession = Depends(get_db), user=Depends(require_write),
                          wid: str = Depends(get_workspace_id)):
    # Verify case belongs to workspace
    case_check = await db.execute(select(Case).where(Case.id == case_id, Case.workspace_id == wid))
    if not case_check.scalar_one_or_none():
        raise HTTPException(404, "Case not found")
    report = Report(workspace_id=wid, title=f"Report for case {case_id}", case_id=case_id,
                    format=format, generated_by=user.id)
    db.add(report)
    db.add(AuditLog(action="report_generated", entity_type="report",
                    user_id=user.id, user_email=user.email, workspace_id=wid,
                    details={"case_id": case_id, "format": format}))
    await db.commit()
    return {"id": report.id, "message": "Report generation queued"}

# ── Leaks Router ──
leaks_router = APIRouter()

@leaks_router.get("/")
async def list_leaks(type: Optional[str] = None, asset_match_only: bool = False,
                     offset: int = 0, limit: int = Query(50, le=200),
                     db: AsyncSession = Depends(get_db), user=Depends(require_read),
                     wid: str = Depends(get_workspace_id)):
    q = select(LeakItem).where(LeakItem.workspace_id == wid)
    if type: q = q.where(LeakItem.type == type)
    if asset_match_only: q = q.where(func.array_length(LeakItem.matched_asset_ids, 1) > 0)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(LeakItem.discovered_at.desc()).offset(offset).limit(limit))
    items = [{"id": l.id, "type": l.type, "title": l.title, "severity": l.severity,
             "source_name": l.source_name, "is_tor_source": l.is_tor_source,
             "evidence_excerpt": l.evidence_excerpt} for l in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

# ── Admin Router ──
admin_router = APIRouter()

@admin_router.get("/users")
async def list_users(offset: int = 0, limit: int = Query(50, le=200),
                     db: AsyncSession = Depends(get_db), user=Depends(require_admin),
                     wid: str = Depends(get_workspace_id)):
    """List users who are members of the current workspace."""
    from app.models.workspace import WorkspaceMember
    q = (
        select(User)
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == wid, WorkspaceMember.is_active == True)
    )
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(User.created_at.desc()).offset(offset).limit(limit))
    items = [{"id": u.id, "email": u.email, "name": u.name, "role": u.role,
             "is_active": u.is_active, "created_at": str(u.created_at)} for u in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

@admin_router.get("/audit-logs")
async def list_audit_logs(action: Optional[str] = None, offset: int = 0, limit: int = Query(100, le=500),
                          db: AsyncSession = Depends(get_db), user=Depends(require_admin),
                          wid: str = Depends(get_workspace_id)):
    q = select(AuditLog).where(AuditLog.workspace_id == wid)
    if action: q = q.where(AuditLog.action == action)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit))
    items = [{"id": a.id, "action": a.action, "entity_type": a.entity_type,
             "user_email": a.user_email, "timestamp": str(a.timestamp),
             "details": a.details} for a in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}

# ── Health Router ──
health_router = APIRouter()

@health_router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check — verifies DB connectivity. Public endpoint (no auth)."""
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok" if db_status == "connected" else "degraded",
            "service": "catshy-api", "version": "1.0.0", "database": db_status}
