"""Phase 3 — Security hardening tests.

Tests cover:
1. Cookie-based auth (login sets cookies, /me works, logout clears)
2. CSRF double-submit validation
3. Redis-backed brute-force detection
4. Audit middleware logging
5. Token extraction (cookie-first, Bearer fallback)
"""
import secrets
import pytest
from unittest.mock import MagicMock, patch, AsyncMock


class TestCookieAuth:
    """Verify cookie-based authentication flow."""

    def test_login_response_includes_cookies_and_csrf(self):
        """Login response must include Set-Cookie headers and csrf_token in body."""
        # This validates the response structure — actual cookie setting is tested via httpx/TestClient
        from app.routers.auth import _set_auth_cookies, _clear_auth_cookies
        from starlette.responses import Response

        response = Response()
        _set_auth_cookies(response, "test-access", "test-refresh", "test-csrf")

        # Check raw_headers for Set-Cookie
        cookie_headers = [
            v.decode() for k, v in response.raw_headers if k.decode().lower() == "set-cookie"
        ]
        assert any("access_token" in c for c in cookie_headers)
        assert any("refresh_token" in c for c in cookie_headers)
        assert any("csrf_token" in c for c in cookie_headers)

        # access_token must be httpOnly
        access_cookie = [c for c in cookie_headers if "access_token" in c][0]
        assert "httponly" in access_cookie.lower()

        # csrf_token must NOT be httpOnly (frontend reads it)
        csrf_cookie = [c for c in cookie_headers if "csrf_token" in c][0]
        assert "httponly" not in csrf_cookie.lower()

    def test_clear_cookies(self):
        from app.routers.auth import _clear_auth_cookies
        from starlette.responses import Response

        response = Response()
        _clear_auth_cookies(response)
        cookie_headers = [
            v.decode() for k, v in response.raw_headers if k.decode().lower() == "set-cookie"
        ]
        # Should set max-age=0 or expires in the past for all auth cookies
        assert len(cookie_headers) >= 3


class TestCSRF:
    """Verify CSRF double-submit cookie validation."""

    def test_csrf_verify_matching_tokens(self):
        from app.core.security import verify_csrf_token
        token = secrets.token_urlsafe(32)
        assert verify_csrf_token(token, token) is True

    def test_csrf_verify_mismatched_tokens(self):
        from app.core.security import verify_csrf_token
        assert verify_csrf_token("token-a", "token-b") is False

    def test_csrf_verify_empty_tokens(self):
        from app.core.security import verify_csrf_token
        assert verify_csrf_token("", "") is False
        assert verify_csrf_token("valid", "") is False
        assert verify_csrf_token("", "valid") is False


class TestTokenExtraction:
    """Verify cookie-first, Bearer-fallback token extraction."""

    def test_extract_from_cookie(self):
        from app.core.deps import _extract_token

        request = MagicMock()
        request.cookies = {"access_token": "cookie-jwt-value"}
        request.headers = {}

        token = _extract_token(request)
        assert token == "cookie-jwt-value"

    def test_extract_from_bearer_header(self):
        from app.core.deps import _extract_token

        request = MagicMock()
        request.cookies = {}
        request.headers = {"Authorization": "Bearer header-jwt-value"}

        token = _extract_token(request)
        assert token == "header-jwt-value"

    def test_cookie_takes_priority_over_bearer(self):
        from app.core.deps import _extract_token

        request = MagicMock()
        request.cookies = {"access_token": "cookie-value"}
        request.headers = {"Authorization": "Bearer header-value"}

        token = _extract_token(request)
        assert token == "cookie-value"

    def test_no_credentials_raises(self):
        from app.core.deps import _extract_token
        from app.core.exceptions import AuthenticationError

        request = MagicMock()
        request.cookies = {}
        request.headers = {}

        with pytest.raises(AuthenticationError):
            _extract_token(request)


class TestRedisBruteForce:
    """Verify Redis-backed brute-force detection."""

    def test_record_and_lockout_with_redis(self):
        """When Redis is available, lockout state is stored in Redis."""
        from app.core import security

        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_redis.pipeline.return_value = mock_pipe
        mock_pipe.execute.return_value = [None, None, security.BRUTE_FORCE_THRESHOLD, None]

        with patch.object(security, '_get_redis', return_value=mock_redis):
            security.record_failed_login("test-key")
            # Should have called setex for lockout
            mock_redis.setex.assert_called_once()

    def test_is_locked_out_checks_redis(self):
        from app.core import security

        mock_redis = MagicMock()
        mock_redis.exists.return_value = 1

        with patch.object(security, '_get_redis', return_value=mock_redis):
            assert security.is_locked_out("locked-key") is True
            mock_redis.exists.assert_called_with("lockout:locked-key")

    def test_production_fails_without_redis(self):
        """In production mode, rate limiting must fail closed without Redis."""
        from app.core import security

        original = security.PRODUCTION
        security.PRODUCTION = True
        try:
            with patch.object(security, '_get_redis', return_value=None):
                with pytest.raises(ValueError, match="Redis required"):
                    security.check_rate_limit("test", 5)
        finally:
            security.PRODUCTION = original


class TestAuditMiddleware:
    """Verify audit middleware structure."""

    def test_middleware_class_exists(self):
        from app.middleware.audit import AuditMiddleware
        assert AuditMiddleware is not None

    def test_skip_paths(self):
        from app.middleware.audit import SKIP_PATHS
        assert "/api/health" in SKIP_PATHS

    def test_sensitive_paths(self):
        from app.middleware.audit import SENSITIVE_PATHS
        assert "/api/auth/login" in SENSITIVE_PATHS

    def test_mask_error_redacts_sensitive(self):
        from app.middleware.audit import _mask_error
        assert "REDACTED" in _mask_error("invalid password hash")
        assert "REDACTED" in _mask_error("bad token value")
        assert "safe error" == _mask_error("safe error")


class TestCSRFMiddleware:
    """Verify CSRF middleware configuration."""

    def test_exempt_paths(self):
        from app.middleware.csrf import CSRF_EXEMPT_PATHS
        assert "/api/auth/login" in CSRF_EXEMPT_PATHS
        assert "/api/auth/register" in CSRF_EXEMPT_PATHS
        assert "/api/auth/csrf-token" in CSRF_EXEMPT_PATHS

    def test_safe_methods(self):
        from app.middleware.csrf import SAFE_METHODS
        assert "GET" in SAFE_METHODS
        assert "OPTIONS" in SAFE_METHODS
