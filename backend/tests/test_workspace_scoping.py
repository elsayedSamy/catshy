"""Workspace isolation tests — verify no cross-tenant data leaks."""
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch


# ── Unit tests for workspace scoping logic ──

class TestWorkspaceScoping:
    """Verify that workspace_id is enforced in all queries."""

    def test_jwt_must_contain_workspace_id(self):
        """JWT without wid claim should be rejected by get_workspace_id."""
        from app.core.exceptions import AuthorizationError

        # Simulate a request with no workspace_id
        mock_request = MagicMock()
        mock_request.state = MagicMock()
        mock_request.state.workspace_id = None

        # get_workspace_id should raise when wid is missing
        import asyncio
        from app.core.deps import get_workspace_id

        async def _test():
            mock_user = MagicMock()
            with pytest.raises(AuthorizationError):
                await get_workspace_id(mock_request, mock_user)

        asyncio.get_event_loop().run_until_complete(_test())

    def test_create_access_token_includes_wid(self):
        """Access token must include workspace_id when provided."""
        from app.routers.auth import create_access_token
        from jose import jwt
        from app.config import settings

        wid = str(uuid.uuid4())
        token = create_access_token("user-123", "user", workspace_id=wid)
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])

        assert payload["wid"] == wid
        assert payload["sub"] == "user-123"
        assert payload["role"] == "user"

    def test_create_access_token_without_wid(self):
        """Access token without workspace_id should not have wid claim."""
        from app.routers.auth import create_access_token
        from jose import jwt
        from app.config import settings

        token = create_access_token("user-123", "user")
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])

        assert "wid" not in payload

    def test_ws_auth_rejects_token_without_wid(self):
        """WebSocket auth should reject tokens missing workspace_id."""
        import asyncio
        from app.routers.ws_threats import _authenticate_ws
        from app.routers.auth import create_access_token

        # Token without wid
        token = create_access_token("user-123", "user")

        async def _test():
            result = await _authenticate_ws(token)
            assert result is None  # Should be rejected

        asyncio.get_event_loop().run_until_complete(_test())

    def test_ws_auth_accepts_token_with_wid(self):
        """WebSocket auth should accept tokens with workspace_id."""
        import asyncio
        from app.routers.ws_threats import _authenticate_ws
        from app.routers.auth import create_access_token

        wid = str(uuid.uuid4())
        token = create_access_token("user-123", "user", workspace_id=wid)

        async def _test():
            result = await _authenticate_ws(token)
            assert result is not None
            assert result["wid"] == wid

        asyncio.get_event_loop().run_until_complete(_test())

    def test_broadcast_is_workspace_scoped(self):
        """broadcast_threat_event should only target clients in the specified workspace."""
        from app.routers.ws_threats import _clients

        ws_a = MagicMock()
        ws_b = MagicMock()

        _clients["workspace-a"] = {ws_a}
        _clients["workspace-b"] = {ws_b}

        import asyncio
        from app.routers.ws_threats import broadcast_threat_event

        async def _test():
            await broadcast_threat_event({"test": True}, "workspace-a")
            ws_a.send_json.assert_called_once()
            ws_b.send_json.assert_not_called()

        asyncio.get_event_loop().run_until_complete(_test())

        # Cleanup
        _clients.clear()


class TestDatetimeConsistency:
    """Verify all models use timezone-aware UTC datetimes."""

    def test_workspace_model_uses_utc(self):
        from app.models.workspace import Workspace
        col = Workspace.__table__.c.created_at
        assert col.type.timezone is True

    def test_system_audit_log_uses_utc(self):
        from app.models.system import SystemAuditLog
        col = SystemAuditLog.__table__.c.timestamp
        assert col.type.timezone is True

    def test_audit_log_uses_utc(self):
        from app.models.system import AuditLog
        col = AuditLog.__table__.c.timestamp
        assert col.type.timezone is True

    def test_intel_item_uses_utc(self):
        from app.models.intel import IntelItem
        col = IntelItem.__table__.c.fetched_at
        assert col.type.timezone is True
