# Re-export all routers for clean imports in main.py
from app.routers.auth import router  # auth has its own router
from app.routers.all_routers import (
    assets_router, sources_router, feed_router, search_router,
    entities_router, alerts_router, cases_router, reports_router,
    leaks_router, admin_router, health_router
)

# Create module-level router references for main.py imports
class _RouterModule:
    def __init__(self, r):
        self.router = r

assets = _RouterModule(assets_router)
sources = _RouterModule(sources_router)
feed = _RouterModule(feed_router)
search = _RouterModule(search_router)
entities = _RouterModule(entities_router)
alerts = _RouterModule(alerts_router)
cases = _RouterModule(cases_router)
reports = _RouterModule(reports_router)
leaks = _RouterModule(leaks_router)
admin = _RouterModule(admin_router)
health = _RouterModule(health_router)
