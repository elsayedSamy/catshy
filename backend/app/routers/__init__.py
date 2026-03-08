# Clean re-exports — no wrapper classes needed
from app.routers.auth import router as auth_router
from app.routers.all_routers import (
    assets_router, sources_router, feed_router, search_router,
    entities_router, alerts_router, cases_router, reports_router,
    leaks_router, admin_router, health_router,
)
