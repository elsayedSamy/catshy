"""CATSHY Backend — FastAPI Application Entry Point"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import engine, Base, async_session
from app.routers import auth, assets, sources, feed, search, entities, alerts, cases, reports, leaks, admin, health
from app.middleware.audit import AuditMiddleware
from app.services.admin_seed import seed_admin
from app.services.mail import validate_smtp_config

logger = logging.getLogger("catshy")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if not using alembic
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed admin user
    async with async_session() as db:
        await seed_admin(db)
    # Validate SMTP
    validate_smtp_config()
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title="CATSHY — Threat Intelligence Platform",
    version="1.0.0",
    description="Self-hosted, production-grade TIP backend",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit logging middleware
app.add_middleware(AuditMiddleware)

# Register routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(assets.router, prefix="/api/assets", tags=["assets"])
app.include_router(sources.router, prefix="/api/sources", tags=["sources"])
app.include_router(feed.router, prefix="/api/feed", tags=["feed"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(entities.router, prefix="/api/entities", tags=["entities"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(cases.router, prefix="/api/cases", tags=["cases"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(leaks.router, prefix="/api/leaks", tags=["leaks"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
