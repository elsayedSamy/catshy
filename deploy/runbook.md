# CATSHY — Operations Runbook

## Quick Reference

### Service Management

```bash
# Start all services
sudo systemctl start catshy-api catshy-celery-worker catshy-celery-beat

# Stop all services
sudo systemctl stop catshy-api catshy-celery-worker catshy-celery-beat

# Restart all services
sudo systemctl restart catshy-api catshy-celery-worker catshy-celery-beat

# Check status
sudo systemctl status catshy-api catshy-celery-worker catshy-celery-beat
```

### Logs

```bash
# API logs
journalctl -u catshy-api -f

# Worker logs (polling, scoring, alerting)
journalctl -u catshy-celery-worker -f

# Beat scheduler logs
journalctl -u catshy-celery-beat -f

# Nginx access/error logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# All CATSHY logs combined
journalctl -u 'catshy-*' -f
```

### Health Checks

```bash
# API health
curl -s http://localhost/api/health | jq

# Expected output:
# { "status": "ok", "service": "catshy-api", "version": "1.0.0" }

# PostgreSQL
sudo -u postgres pg_isready

# Redis
redis-cli -a $(grep REDIS_PASS /opt/catshy/backend/.env | cut -d= -f2) ping

# Celery worker inspection
cd /opt/catshy/backend && source venv/bin/activate
celery -A app.tasks.celery_app inspect active
celery -A app.tasks.celery_app inspect scheduled
```

### Database

```bash
# Connect to database
sudo -u postgres psql -d catshy

# Backup database
sudo -u postgres pg_dump catshy > /opt/catshy/data/backup_$(date +%Y%m%d).sql

# Restore database
sudo -u postgres psql -d catshy < /opt/catshy/data/backup_YYYYMMDD.sql

# Run migrations
cd /opt/catshy/backend && source venv/bin/activate
alembic upgrade head

# Check migration status
alembic current
alembic history

# Table sizes
sudo -u postgres psql -d catshy -c "
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Threat Feed & History — Time Windows & Retention

**Time Windows:**
- **Fresh Feed** (`/api/threats/feed`): Items where `COALESCE(published_at, fetched_at)` is within the last 24 hours.
- **History** (`/api/threats/history`): Items older than 24h but within 30 days. Supports `range=24h|7d|30d` or custom `start`/`end` ISO dates (max 30 days).
- **Retention**: Items older than 30 days are hard-deleted by an hourly Celery task (`cleanup_old_intel_items`).

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/threats/feed` | GET | Fresh items < 24h. Params: `severity`, `source_id`, `asset_match_only`, `sort`, `offset`, `limit` |
| `/api/threats/history` | GET | Aged items. Params: `range`, `start`, `end`, `severity`, `search`, `offset`, `limit` |
| `/api/threats/reports/generate` | POST | Generate report. Body: `{ scope, preset, start, end, format, severity }` |

**Report Formats:** CSV (default), HTML, JSON. PDF available if WeasyPrint is installed.

**Cleanup Job:**
- Runs hourly via Celery Beat (`cleanup-old-intel`).
- Deletes all `intel_items` where `COALESCE(published_at, fetched_at) < now - 30d`.
- Logs count of deleted records.

**Manual cleanup (dev/debug):**
```bash
cd /opt/catshy/backend && source venv/bin/activate
celery -A app.tasks.celery_app call app.tasks.retention.cleanup_old_intel_items
```

### Button-to-Endpoint Map (Feed / History / Reports)

| Page | UI Control | Action | API Endpoint | Backend Handler | DB Table | I/O |
|------|-----------|--------|-------------|----------------|----------|-----|
| Feed | **Refresh** button | Re-fetch fresh items | `GET /api/threats/feed` | `threats.threat_feed()` | `intel_items` (read) | Returns items < 24h |
| Feed | **Severity** select | Filter by severity | `GET /api/threats/feed?severity=X` | `threats.threat_feed()` | `intel_items` (read) | Filtered result |
| Feed | **Type** select | Filter by observable type | Client-side filter | N/A | N/A | Filters displayed items |
| Feed | **Company Match** toggle | Filter asset-matched items | Client-side filter / `?asset_match_only=true` | `threats.threat_feed()` | `intel_items` (read) | Only asset-matched |
| Feed | **Company First** toggle | Sort asset-matched to top | Client-side sort | N/A | N/A | Re-orders displayed list |
| Feed | **View History** button | Navigate to /history | N/A (navigation) | N/A | N/A | Page redirect |
| Feed | **Download Report** button | Generate + download report | `POST /api/threats/reports/generate` | `threats.generate_threat_report()` | `intel_items` (read) | Streams CSV/HTML/JSON file |
| Feed | **Time Window** select | Set report time scope | Used in report POST body | `threats.generate_threat_report()` | `intel_items` (read) | `preset: today\|7d\|30d` |
| Feed | **Start/End** date pickers | Custom date range for report | Used in report POST body | `threats.generate_threat_report()` | `intel_items` (read) | `start/end` ISO dates |
| Feed | **Format** select | Set export format | Used in report POST body | `threats.generate_threat_report()` | N/A | `format: csv\|html\|json` |
| Feed | **Clear** filters button | Reset all URL filter params | Client-side URL reset | N/A | N/A | Clears search params |
| Feed | **External Link** icon | Open original source URL | N/A (external link) | N/A | N/A | Opens `original_url` |
| History | **Refresh** button | Re-fetch history items | `GET /api/threats/history?range=X` | `threats.threat_history()` | `intel_items` (read) | Returns items in range |
| History | **Last 24h/7d/30d** tabs | Change time range | `GET /api/threats/history?range=X` | `threats.threat_history()` | `intel_items` (read) | Filtered by range |
| History | **Search** input | Keyword search in title/desc | `GET /api/threats/history?search=X` | `threats.threat_history()` | `intel_items` (read) | ILIKE search |
| History | **Severity** select | Filter by severity | Client-side filter | N/A | N/A | Filters displayed items |
| History | **Type** select | Filter by observable type | Client-side filter | N/A | N/A | Filters displayed items |
| History | **Company Match** toggle | Filter asset-matched items | Client-side filter | N/A | N/A | Only asset-matched |
| History | **Live Feed** button | Navigate to /feed | N/A (navigation) | N/A | N/A | Page redirect |
| History | **External Link** icon | Open original source URL | N/A (external link) | N/A | N/A | Opens `original_url` |

### How to Verify (Click-Through Checklist)

**Prerequisites:** Start the app (dev mode or with backend).

**Feed Page (`/feed`):**
1. ✅ Page loads with items < 24h old
2. ✅ Click "Severity" → select "Critical" → only critical items shown
3. ✅ Click "Type" → select "CVE" → only CVE items shown
4. ✅ Click "Company Match" → only asset-matched items shown
5. ✅ Click "Clear" → all filters removed, all items shown
6. ✅ Click "Company First" → asset-matched items sort to top
7. ✅ Click "Refresh" → feed re-fetches (loading spinner appears)
8. ✅ Click "View History" → navigates to /history
9. ✅ Click external link icon → opens source URL in new tab
10. ✅ Select "Today (24h)" + CSV → click "Download Report" → CSV downloads with only <24h items
11. ✅ Select "Last 7 days" + CSV → download → CSV includes items from past 7 days
12. ✅ Select "Custom Range" → pick start/end dates → download → correct date range in file
13. ✅ Select "Custom Range" with end < start → error shown, button disabled
14. ✅ Select HTML format → download → opens as styled HTML report
15. ✅ Select JSON format → download → valid JSON with metadata

**History Page (`/history`):**
1. ✅ Page loads with items older than 24h
2. ✅ Click "Last 24h" tab → shows only recent history items
3. ✅ Click "Last 7 days" tab → shows items within 7 days
4. ✅ Click "Last 30 days" tab → shows all items within 30 days
5. ✅ Type in search box → filters by title/description match
6. ✅ Click "Severity" → select "High" → only high-severity items
7. ✅ Click "Company Match" → only asset-matched items
8. ✅ Click "Clear" → all filters removed
9. ✅ Click "Refresh" → data re-fetches
10. ✅ Click "Live Feed" → navigates to /feed

**API Verification (with backend):**
```bash
# Feed: fresh items only
curl -s http://localhost/api/threats/feed | jq '.total, (.items | length)'

# History: default (>24h, <30d)
curl -s http://localhost/api/threats/history | jq '.total'

# History: specific range
curl -s "http://localhost/api/threats/history?range=7d" | jq '.total'

# Report: CSV for today
curl -X POST http://localhost/api/threats/reports/generate \
  -H "Content-Type: application/json" \
  -d '{"preset":"today","format":"csv"}' -o report.csv

# Report: custom range (should reject >30d)
curl -X POST http://localhost/api/threats/reports/generate \
  -H "Content-Type: application/json" \
  -d '{"start":"2025-01-01","end":"2026-02-11","format":"csv"}'
# Expected: 400 "Max range is 30 days"

# Retention: verify no items >30d
curl -s "http://localhost/api/threats/history?range=30d" | jq '[.items[] | select(.published_at < "2026-01-12")] | length'
# Expected: 0
```


```bash
# Re-initialize source catalog (safe, skips existing)
cd /opt/catshy/backend && source venv/bin/activate
curl -X POST http://localhost/api/sources/initialize -H "Authorization: Bearer $TOKEN"

# Force poll a specific source
curl -X POST http://localhost/api/sources/cisa-kev/enable -H "Authorization: Bearer $TOKEN"

# Check source health
curl -s http://localhost/api/sources/ -H "Authorization: Bearer $TOKEN" | jq '.[] | {name, health, item_count}'
```

### User Management

```bash
# Create user via API
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"analyst@company.com","name":"Analyst","password":"SecurePass123!","role":"analyst"}'

# List users (requires admin token)
curl -s http://localhost/api/admin/users -H "Authorization: Bearer $TOKEN" | jq
```

### SSL/TLS Setup

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

### Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| API returns 502 | `systemctl status catshy-api` | `systemctl restart catshy-api` |
| Sources not polling | `journalctl -u catshy-celery-worker -n 50` | `systemctl restart catshy-celery-worker` |
| DB connection error | `pg_isready` | `systemctl restart postgresql` |
| Redis connection error | `redis-cli ping` | `systemctl restart redis-server` |
| Search returns empty | Check FTS indexes | `psql -d catshy -c "REINDEX INDEX ix_intel_search_vector;"` |
| High memory usage | `htop`, check worker concurrency | Reduce `--concurrency` in worker service |
| Source stuck in degraded | Check `backoff_until` in sources table | Reset via API or direct SQL |

### E2E Test

```bash
cd /opt/catshy/backend && source venv/bin/activate
python3 tests/test_e2e.py

# Expected: All 15 steps pass with ✅
```

### Update Procedure

```bash
# 1. Stop services
sudo systemctl stop catshy-api catshy-celery-worker catshy-celery-beat

# 2. Backup database
sudo -u postgres pg_dump catshy > /opt/catshy/data/backup_pre_update.sql

# 3. Update code
cd /opt/catshy && git pull  # or copy new files

# 4. Update dependencies
cd backend && source venv/bin/activate && pip install -r requirements.txt

# 5. Run migrations
alembic upgrade head

# 6. Rebuild frontend
cd /opt/catshy/frontend && npm install && npx vite build --outDir dist

# 7. Restart services
sudo systemctl start catshy-api catshy-celery-worker catshy-celery-beat

# 8. Verify
curl http://localhost/api/health
```
