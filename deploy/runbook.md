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

### Source Catalog Management

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
