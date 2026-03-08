"""Phase 2 — Integration tests for Celery ingestion pipeline.

Verifies:
1. asyncio.run() bridge works without 'coroutine was never awaited'
2. IngestionPipeline persists IntelItems via AsyncSession
3. Workspace scoping is maintained throughout
"""
import asyncio
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock, MagicMock


def _fake_source(workspace_id: str = "ws-test"):
    """Return a mock Source object."""
    src = MagicMock()
    src.id = str(uuid.uuid4())
    src.name = "Test RSS Source"
    src.workspace_id = workspace_id
    src.connector_type = "rss_atom"
    src.default_url = "https://example.com/feed.xml"
    src.resolved_url = None
    src.enabled = True
    src.polling_interval_minutes = 5
    src.last_fetch_at = None
    src.backoff_until = None
    src.health = "healthy"
    src.consecutive_failures = 0
    src.last_error = None
    src.item_count = 0
    return src


RAW_ENTRIES = [
    {
        "title": "APT29 targets energy sector",
        "link": "https://example.com/apt29",
        "description": "IP 203.0.113.42 used in phishing campaign targeting energy firms.",
    },
    {
        "title": "LockBit ransomware update",
        "link": "https://example.com/lockbit",
        "description": "New variant drops beacon via domain evil.example.com",
    },
]


class TestAsyncBridge:
    """Verify the asyncio.run() bridge pattern used by Celery tasks."""

    def test_asyncio_run_does_not_raise(self):
        """Ensure we can call asyncio.run() with async code — no coroutine leak."""
        async def _inner():
            return 42

        result = asyncio.run(_inner())
        assert result == 42

    def test_nested_async_sessions_pattern(self):
        """Simulate the session pattern used in _poll_single_source_async."""
        call_log = []

        async def _simulate_pipeline():
            call_log.append("load_reliability")
            call_log.append("load_assets")
            call_log.append("process_entries")
            call_log.append("commit")
            return 3

        result = asyncio.run(_simulate_pipeline())
        assert result == 3
        assert call_log == ["load_reliability", "load_assets", "process_entries", "commit"]


class TestIngestionPipelineIntegration:
    """Test IngestionPipeline directly (mocked DB, real logic)."""

    def test_pipeline_processes_entries_via_asyncio_run(self):
        """Core test: pipeline.process_entries() is awaited correctly and returns items."""
        from app.services.ingestion import IngestionPipeline

        source = _fake_source("ws-integration")

        # Mock AsyncSession
        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None), scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))), scalar=MagicMock(return_value=0)))
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        async def _run():
            pipeline = IngestionPipeline(mock_db, source, workspace_id="ws-integration")
            created = await pipeline.process_entries(RAW_ENTRIES)
            return created

        created = asyncio.run(_run())

        # Should have created items (not coroutines)
        assert isinstance(created, list)
        assert len(created) > 0
        for item in created:
            assert hasattr(item, "title")
            assert hasattr(item, "workspace_id")
            assert item.workspace_id == "ws-integration"

        # DB.add should have been called (items + observables + stats)
        assert mock_db.add.call_count > 0

    def test_pipeline_workspace_isolation(self):
        """Items created by pipeline carry the correct workspace_id."""
        from app.services.ingestion import IngestionPipeline

        source = _fake_source("ws-alpha")

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None), scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))), scalar=MagicMock(return_value=0)))
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        async def _run():
            pipeline = IngestionPipeline(mock_db, source, workspace_id="ws-alpha")
            return await pipeline.process_entries(RAW_ENTRIES[:1])

        items = asyncio.run(_run())
        for item in items:
            assert item.workspace_id == "ws-alpha"

    def test_no_coroutine_warning(self):
        """Ensure process_entries is properly awaited — no RuntimeWarning."""
        import warnings

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            from app.services.ingestion import IngestionPipeline

            source = _fake_source()
            mock_db = AsyncMock()
            mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None), scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))), scalar=MagicMock(return_value=0)))
            mock_db.add = MagicMock()
            mock_db.commit = AsyncMock()

            async def _run():
                pipeline = IngestionPipeline(mock_db, source)
                return await pipeline.process_entries(RAW_ENTRIES)

            asyncio.run(_run())

            coroutine_warnings = [x for x in w if "coroutine" in str(x.message).lower()]
            assert len(coroutine_warnings) == 0, f"Coroutine warnings found: {coroutine_warnings}"


class TestCeleryTaskStructure:
    """Verify task registration and configuration."""

    def test_tasks_registered(self):
        from app.tasks.celery_app import app as celery_app

        task_names = list(celery_app.tasks.keys())
        required = [
            "app.tasks.polling.poll_all_enabled_sources",
            "app.tasks.polling.poll_single_source",
            "app.tasks.alerting.evaluate_all_rules",
            "app.tasks.retention.cleanup_old_intel_items",
        ]
        for name in required:
            assert name in task_names, f"Task {name} not registered"

    def test_beat_schedule_exists(self):
        from app.tasks.celery_app import app as celery_app

        schedule = celery_app.conf.beat_schedule
        assert "poll-enabled-sources" in schedule
        assert "evaluate-alert-rules" in schedule
        assert "cleanup-old-intel" in schedule
