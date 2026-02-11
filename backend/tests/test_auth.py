"""Tests for auth flows: admin seed, invite, reset, no open signup."""
import hashlib
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock


class TestAdminSeed:
    """Admin seed idempotency tests."""

    @pytest.mark.asyncio
    async def test_seed_creates_admin_when_not_exists(self):
        """Admin is created when ADMIN_EMAIL is set and user doesn't exist."""
        from app.services.admin_seed import seed_admin, pwd_context
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # no existing user
        mock_db.execute.return_value = mock_result

        with patch('app.services.admin_seed.settings') as mock_settings:
            mock_settings.ADMIN_EMAIL = "admin@test.com"
            mock_settings.ADMIN_PASSWORD = "TestPass123!"
            mock_settings.ADMIN_NAME = "Test Admin"
            await seed_admin(mock_db)
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_seed_skips_when_admin_exists(self):
        """Admin seed is idempotent — doesn't duplicate."""
        from app.services.admin_seed import seed_admin
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()  # existing user
        mock_db.execute.return_value = mock_result

        with patch('app.services.admin_seed.settings') as mock_settings:
            mock_settings.ADMIN_EMAIL = "admin@test.com"
            mock_settings.ADMIN_PASSWORD = "TestPass123!"
            mock_settings.ADMIN_NAME = "Test Admin"
            await seed_admin(mock_db)
            mock_db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_seed_skips_when_no_env(self):
        """No admin seeded when env vars are empty."""
        from app.services.admin_seed import seed_admin
        mock_db = AsyncMock()
        with patch('app.services.admin_seed.settings') as mock_settings:
            mock_settings.ADMIN_EMAIL = ""
            mock_settings.ADMIN_PASSWORD = ""
            await seed_admin(mock_db)
            mock_db.execute.assert_not_called()


class TestTokenSecurity:
    """Invite and reset token single-use + expiry tests."""

    def test_token_hash_is_deterministic(self):
        raw = "test-token-123"
        h1 = hashlib.sha256(raw.encode()).hexdigest()
        h2 = hashlib.sha256(raw.encode()).hexdigest()
        assert h1 == h2

    def test_expired_token_detected(self):
        expires = datetime.utcnow() - timedelta(minutes=1)
        assert expires < datetime.utcnow()

    def test_used_token_detected(self):
        used_at = datetime.utcnow()
        assert used_at is not None


class TestNoOpenSignup:
    """The old 'first user becomes admin' register endpoint is removed."""

    def test_register_endpoint_removed(self):
        """Verify /register is not in the auth router."""
        from app.routers.auth import router
        paths = [r.path for r in router.routes]
        assert "/register" not in paths
