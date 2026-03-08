# TAXII 2.1 Integration — Design Proposal

## Overview
CATSHY will support TAXII 2.1 for bidirectional sharing of threat intelligence with external systems (SIEM/SOAR/TIP/ISAC).

## Phase 1: TAXII Client (Priority)
Start as a **TAXII 2.1 client** to consume external TAXII feeds.

### Architecture
- **Per-workspace configuration**: Each workspace can add TAXII server connections
- **Collections mapping**: Each TAXII collection maps to a CATSHY source
- **Auth methods**: API token (Bearer) and HTTP Basic Auth, configurable per connection
- **Polling schedule**: Configurable per source (default: 15 min), respects workspace polling interval overrides
- **Rate limits**: Configurable per connection, default 60 req/min

### Configuration Model
```
workspace_taxii_connections:
  - id: uuid
  - workspace_id: uuid (FK)
  - server_url: text (encrypted)
  - auth_type: enum (bearer, basic)
  - auth_credential: text (encrypted via INTEGRATIONS_MASTER_KEY)
  - discovery_url: text
  - collections: jsonb (selected collection IDs)
  - poll_interval_seconds: int (default 900)
  - rate_limit_rpm: int (default 60)
  - last_poll_at: timestamp
  - status: enum (active, paused, error)
  - created_at: timestamp
```

### Endpoints (Phase 1)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/taxii/connections` | List workspace TAXII connections |
| POST | `/api/taxii/connections` | Add a TAXII server connection |
| POST | `/api/taxii/connections/{id}/discover` | Discover available collections |
| POST | `/api/taxii/connections/{id}/poll` | Trigger manual poll |
| DELETE | `/api/taxii/connections/{id}` | Remove connection |

### Ingestion Flow
1. Celery beat triggers TAXII poll task per active connection
2. Client fetches objects from selected collections (with `added_after` filtering)
3. STIX 2.1 objects are parsed and normalized into CATSHY IntelItem/Observable format
4. Standard dedup + scoring + MITRE mapping pipeline applies

## Phase 2: TAXII Server (Future)
Expose CATSHY intelligence as a TAXII 2.1 server for downstream consumers.

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/taxii2/` | Discovery document |
| GET | `/taxii2/api-root/` | API root info |
| GET | `/taxii2/api-root/collections/` | List collections (per workspace) |
| GET | `/taxii2/api-root/collections/{id}/objects/` | Get STIX objects (paginated) |

### Collection Strategy
- One collection per workspace (default)
- Optional: separate collections for severity tiers (critical, high, medium/low)
- Auth: workspace API token (tied to workspace integration keys)

## Security Considerations
- All TAXII credentials encrypted at rest (same as BYOK keys)
- Workspace isolation enforced at query layer
- SSRF protection on TAXII server URLs
- TLS required for production TAXII connections
- Audit logging for all TAXII operations

## Dependencies
- `taxii2-client` (Python library for Phase 1)
- STIX export service (Phase 7 — already implemented)
