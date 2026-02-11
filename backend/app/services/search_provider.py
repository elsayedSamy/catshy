"""Pluggable search provider — PostgreSQL FTS with OpenSearch swap capability"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class SearchProvider(ABC):
    """Abstract search interface — swap implementations without changing API layer."""

    @abstractmethod
    async def search(self, query: str, filters: dict = None, offset: int = 0, limit: int = 30) -> dict:
        pass

    @abstractmethod
    async def index_item(self, item_id: str, item_type: str, data: dict) -> None:
        pass

    @abstractmethod
    async def delete_item(self, item_id: str) -> None:
        pass


class PostgresFTSProvider(SearchProvider):
    """PostgreSQL Full-Text Search implementation with trigram similarity."""

    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory

    async def search(self, query: str, filters: dict = None, offset: int = 0, limit: int = 30) -> dict:
        from sqlalchemy import text
        async with self.db_session_factory() as db:
            # Build FTS query with ranking
            sql = text("""
                SELECT id, 'intel_item' as item_type, title, severity, observable_type,
                       ts_rank(search_vector, plainto_tsquery('english', :q)) as rank
                FROM intel_items
                WHERE search_vector @@ plainto_tsquery('english', :q)
                ORDER BY rank DESC
                OFFSET :offset LIMIT :limit
            """)
            result = await db.execute(sql, {"q": query, "offset": offset, "limit": limit})
            intel_rows = result.fetchall()

            # Also search entities
            entity_sql = text("""
                SELECT id, type as item_type, name as title, 'info' as severity, type as observable_type,
                       ts_rank(search_vector, plainto_tsquery('english', :q)) as rank
                FROM entities
                WHERE search_vector @@ plainto_tsquery('english', :q)
                ORDER BY rank DESC
                LIMIT 20
            """)
            entity_result = await db.execute(entity_sql, {"q": query})
            entity_rows = entity_result.fetchall()

            # Fallback: trigram similarity if FTS returns nothing
            if not intel_rows and not entity_rows:
                trigram_sql = text("""
                    SELECT id, 'intel_item' as item_type, title, severity, observable_type,
                           similarity(title || ' ' || COALESCE(observable_value, ''), :q) as rank
                    FROM intel_items
                    WHERE similarity(title || ' ' || COALESCE(observable_value, ''), :q) > 0.1
                    ORDER BY rank DESC
                    OFFSET :offset LIMIT :limit
                """)
                result = await db.execute(trigram_sql, {"q": query, "offset": offset, "limit": limit})
                intel_rows = result.fetchall()

            return {
                "intel_items": [{"id": r[0], "type": r[4], "title": r[2], "severity": r[3], "rank": float(r[5])} for r in intel_rows],
                "entities": [{"id": r[0], "type": r[1], "name": r[2], "rank": float(r[5])} for r in entity_rows],
                "total": len(intel_rows) + len(entity_rows),
                "provider": "postgres_fts",
            }

    async def index_item(self, item_id: str, item_type: str, data: dict) -> None:
        # PostgreSQL FTS is auto-indexed via triggers/generated columns
        pass

    async def delete_item(self, item_id: str) -> None:
        pass


class OpenSearchProvider(SearchProvider):
    """OpenSearch implementation — swap in when ready for enterprise-grade search."""

    def __init__(self, hosts: list, index_prefix: str = "catshy"):
        self.hosts = hosts
        self.index_prefix = index_prefix
        # from opensearchpy import AsyncOpenSearch
        # self.client = AsyncOpenSearch(hosts=hosts)

    async def search(self, query: str, filters: dict = None, offset: int = 0, limit: int = 30) -> dict:
        raise NotImplementedError("OpenSearch provider not yet configured. Install opensearch-py and configure hosts.")

    async def index_item(self, item_id: str, item_type: str, data: dict) -> None:
        raise NotImplementedError()

    async def delete_item(self, item_id: str) -> None:
        raise NotImplementedError()
