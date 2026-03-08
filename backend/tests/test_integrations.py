"""Phase 4 — Tests for integrations encryption, RBAC, and workspace settings."""
import pytest
from unittest.mock import MagicMock, patch


class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from cryptography.fernet import Fernet
        key = Fernet.generate_key().decode()
        with patch.dict("os.environ", {"INTEGRATIONS_MASTER_KEY": key}):
            import importlib
            from app.services import encryption
            encryption._fernet = None
            importlib.reload(encryption)
            encrypted = encryption.encrypt_api_key("sk-test-12345")
            assert encrypted != "sk-test-12345"
            decrypted = encryption.decrypt_api_key(encrypted)
            assert decrypted == "sk-test-12345"

    def test_mask_api_key(self):
        from app.services.encryption import mask_api_key
        assert mask_api_key("sk-abcdef123456") == "********3456"
        assert mask_api_key("ab") == "****"

    def test_decrypt_with_wrong_key_fails(self):
        from cryptography.fernet import Fernet
        key1 = Fernet.generate_key().decode()
        key2 = Fernet.generate_key().decode()
        with patch.dict("os.environ", {"INTEGRATIONS_MASTER_KEY": key1}):
            from app.services import encryption
            encryption._fernet = None
            encrypted = encryption.encrypt_api_key("secret")
        with patch.dict("os.environ", {"INTEGRATIONS_MASTER_KEY": key2}):
            encryption._fernet = None
            with pytest.raises(ValueError):
                encryption.decrypt_api_key(encrypted)


class TestIntegrationModel:
    def test_supported_providers_exist(self):
        from app.routers.integrations import SUPPORTED_PROVIDERS
        assert "virustotal" in SUPPORTED_PROVIDERS
        assert "shodan" in SUPPORTED_PROVIDERS
        assert "abuseipdb" in SUPPORTED_PROVIDERS
        assert "otx" in SUPPORTED_PROVIDERS


class TestWorkspaceSettingsDefaults:
    def test_default_values(self):
        from app.models.integrations import WorkspaceSettings
        s = WorkspaceSettings(workspace_id="test")
        assert s.retention_days == 30
        assert s.auto_enrich == True
        assert s.notify_on_critical == True


class TestEnrichmentOrchestrator:
    def test_no_keys_returns_not_configured(self):
        import asyncio
        from app.services.enrichment import EnrichmentOrchestrator
        orch = EnrichmentOrchestrator(keys={})
        assert orch.available_providers == []
        result = asyncio.run(orch.enrich("ip", "8.8.8.8"))
        for provider_result in result.values():
            assert provider_result["status"] == "not_configured"
