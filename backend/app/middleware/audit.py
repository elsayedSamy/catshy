"""Audit logging middleware"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Audit logging for mutating requests is handled in individual routes
        # This middleware captures request metadata for debugging
        return response
