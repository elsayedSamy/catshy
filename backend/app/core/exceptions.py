"""Custom exceptions for the CATSHY platform."""
from fastapi import HTTPException, status


class AuthenticationError(HTTPException):
    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class AuthorizationError(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class NotFoundError(HTTPException):
    def __init__(self, resource: str = "Resource", detail: str | None = None):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail or f"{resource} not found")


class ConflictError(HTTPException):
    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class RateLimitError(HTTPException):
    def __init__(self, detail: str = "Too many requests. Try again later."):
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)


class TenantIsolationError(HTTPException):
    """Raised when a user attempts cross-tenant access."""
    def __init__(self):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: cross-tenant request blocked")
