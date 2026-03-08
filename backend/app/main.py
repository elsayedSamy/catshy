"""CATSHY Backend — FastAPI Application Entry Point"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import engine, Base, async_session
from app.routers.auth import router as auth_router
from app.routers.all_routers import (
    assets_router, sources_router, feed_router, search_router,
    entities_router, alerts_router, cases_router, reports_router,
    leaks_router, admin_router, health_router,
)
from app.routers.dashboard import dashboard_router, map_router
from app.routers.threats import threats_router, reports_gen_router
from app.routers.system import router as system_router
from app.routers.map_incidents import router as map_incidents_router
from app.routers.feedback import router as feedback_router
from app.routers.dashboard_extended import router as dashboard_extended_router
from app.routers.ws_threats import router as ws_threats_router
from app.routers.enrichment import router as enrichment_router
from app.routers.workspaces import router as workspaces_router
from app.routers.integrations import router as integrations_router
from app.routers.settings import router as settings_router
from app.routers.source_health import router as source_health_router
from app.routers.lifecycle import router as lifecycle_router
from app.routers.stix_export import router as stix_export_router
from app.routers.vulnerabilities import router as vulns_router
from app.routers.leak_monitor import router as leak_monitor_router
from app.routers.outputs import router as outputs_router
from app.routers.ai import router as ai_router
from app.routers.correlation import router as correlation_router
from app.routers.executive import router as executive_router
from app.middleware.audit import AuditMiddleware
from app.middleware.csrf import CSRFMiddleware
from app.services.admin_seed import seed_admin
from app.services.mail import validate_smtp_config

logger = logging.getLogger("catshy")

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as db:
        await seed_admin(db)
    validate_smtp_config()
    yield
    await engine.dispose()

app = FastAPI(
    title="CATSHY — Threat Intelligence Platform",
    version="1.0.0",
    description="Self-hosted, production-grade TIP backend",
    lifespan=lifespan,
)

# CORS — must allow credentials for cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-CSRF-Token"],
    expose_headers=["X-Request-ID"],
)

# CSRF protection (must be AFTER CORS so preflight OPTIONS pass through)
app.add_middleware(CSRFMiddleware)

# Audit logging middleware
app.add_middleware(AuditMiddleware)

# Register routers
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(system_router, prefix="/api/system", tags=["system"])
app.include_router(assets_router, prefix="/api/assets", tags=["assets"])
app.include_router(sources_router, prefix="/api/sources", tags=["sources"])
app.include_router(feed_router, prefix="/api/feed", tags=["feed"])
app.include_router(search_router, prefix="/api/search", tags=["search"])
app.include_router(entities_router, prefix="/api/entities", tags=["entities"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["alerts"])
app.include_router(cases_router, prefix="/api/cases", tags=["cases"])
app.include_router(reports_router, prefix="/api/reports", tags=["reports"])
app.include_router(leaks_router, prefix="/api/leaks", tags=["leaks"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(map_router, prefix="/api/map", tags=["map"])
app.include_router(threats_router, prefix="/api/threats", tags=["threats"])
app.include_router(reports_gen_router, prefix="/api/threats/reports", tags=["threat-reports"])
app.include_router(map_incidents_router, prefix="/api/map", tags=["map-incidents"])
app.include_router(feedback_router, prefix="/api/feedback", tags=["feedback"])
app.include_router(dashboard_extended_router, prefix="/api/dashboard", tags=["dashboard-extended"])
app.include_router(ws_threats_router, prefix="/api/threats", tags=["threats-ws"])
app.include_router(enrichment_router, prefix="/api/enrichment", tags=["enrichment"])
app.include_router(workspaces_router, prefix="/api/workspaces", tags=["workspaces"])
app.include_router(integrations_router, prefix="/api/integrations", tags=["integrations"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(source_health_router, prefix="/api/sources", tags=["source-health"])
app.include_router(lifecycle_router, prefix="/api/intel", tags=["lifecycle"])
app.include_router(stix_export_router, prefix="/api/stix", tags=["stix-export"])
app.include_router(vulns_router, prefix="/api/vulnerabilities", tags=["vulnerabilities"])
app.include_router(leak_monitor_router, prefix="/api/leaks", tags=["leak-monitor"])
app.include_router(outputs_router, prefix="/api/outputs", tags=["outputs"])
app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
app.include_router(correlation_router, prefix="/api/correlation", tags=["correlation"])
