"""Real Audit Middleware — logs every request with correlation ID, user context, latency, and masking."""
import logging
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("catshy.audit")

# Paths whose request/response bodies should never be logged
SENSITIVE_PATHS = {"/api/auth/login", "/api/auth/register", "/api/auth/reset-password",
                   "/api/auth/accept-invite", "/api/auth/refresh", "/api/auth/me"}

# Paths to skip entirely (health checks, static)
SKIP_PATHS = {"/api/health", "/favicon.ico", "/robots.txt"}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip noisy endpoints
        path = request.url.path
        if path in SKIP_PATHS or path.startswith("/assets"):
            return await call_next(request)

        request_id = str(uuid.uuid4())[:12]
        request.state.request_id = request_id

        # Extract user info if available (set later by deps, but check cookie/header for early logging)
        user_id = "-"
        workspace_id = "-"
        ip = request.client.host if request.client else "-"
        ua = request.headers.get("user-agent", "-")[:200]
        method = request.method
        is_sensitive = path in SENSITIVE_PATHS

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            latency_ms = round((time.perf_counter() - start) * 1000, 1)
            # Try to get user from request.state if deps ran
            user_id = getattr(getattr(request.state, "user", None), "id", "-")
            workspace_id = getattr(request.state, "workspace_id", None) or "-"

            logger.error(
                "req_id=%s method=%s path=%s status=500 latency_ms=%s user=%s ws=%s ip=%s error=%s",
                request_id, method, path, latency_ms, user_id, workspace_id, ip,
                _mask_error(str(exc)) if is_sensitive else str(exc)[:500],
            )
            raise

        latency_ms = round((time.perf_counter() - start) * 1000, 1)

        # Pull user/workspace from request.state (set by auth deps during request)
        user_id = getattr(getattr(request.state, "user", None), "id", "-")
        workspace_id = getattr(request.state, "workspace_id", None) or "-"

        log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            log_level,
            "req_id=%s method=%s path=%s status=%s latency_ms=%s user=%s ws=%s ip=%s ua=%s",
            request_id, method, path, response.status_code, latency_ms,
            user_id, workspace_id, ip, ua[:80],
        )

        # Add correlation header to response
        response.headers["X-Request-ID"] = request_id
        return response


def _mask_error(msg: str) -> str:
    """Mask potential sensitive data in error messages."""
    for word in ("password", "token", "secret", "api_key", "apikey"):
        if word in msg.lower():
            return "[REDACTED_SENSITIVE_ERROR]"
    return msg[:500]
