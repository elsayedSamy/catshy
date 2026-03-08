"""CSRF protection middleware — double-submit cookie pattern.

How it works:
1. On GET /api/auth/csrf-token, backend sets a `csrf_token` cookie (NOT httpOnly)
   and returns the token value. Frontend reads it and sends it as X-CSRF-Token header.
2. On state-changing requests (POST/PUT/PATCH/DELETE), this middleware compares
   the cookie value with the header value. If they don't match → 403.
3. Safe methods (GET/HEAD/OPTIONS) and auth endpoints are exempt.
"""
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from app.core.security import verify_csrf_token

logger = logging.getLogger("catshy.csrf")

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Endpoints exempt from CSRF (they handle their own auth or are login flows)
CSRF_EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/auth/verify-email",
    "/api/auth/accept-invite",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
    "/api/auth/csrf-token",
    "/api/health",
}


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in SAFE_METHODS:
            return await call_next(request)

        path = request.url.path
        if path in CSRF_EXEMPT_PATHS:
            return await call_next(request)

        # WebSocket upgrade requests are exempt
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)

        # Double-submit cookie check
        cookie_token = request.cookies.get("csrf_token")
        header_token = request.headers.get("x-csrf-token")

        if not verify_csrf_token(cookie_token or "", header_token or ""):
            logger.warning("CSRF validation failed: path=%s ip=%s", path,
                           request.client.host if request.client else "-")
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF validation failed. Refresh and try again."},
            )

        return await call_next(request)
