# CATSHY — Threat Intelligence Platform

<p align="center">
  <strong>Self-hosted Threat Intelligence Platform for cybersecurity teams</strong><br/>
  Collect, correlate, score, and act on threat intelligence from 20+ OSINT sources.
</p>

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| **Backend** | FastAPI (async) + Python 3.12 |
| **Database** | PostgreSQL 16 (asyncpg + full-text search) |
| **Cache/Queue** | Redis 7 + Celery |
| **Visualization** | Recharts, React Three Fiber (3D Globe) |
| **Auth** | JWT (bcrypt) + Role-Based Access Control |
| **Deployment** | Docker Compose / systemd (Kali Linux) / Windows |

---

## 📋 Features

### Intelligence Pipeline
- **20+ OSINT Sources**: CISA KEV, NVD, Feodo Tracker, URLhaus, OpenPhish, MalwareBazaar, and more
- **10-Stage Ingestion**: Fetch → Normalize → Dedup → Enrich → Correlate → Score → Explain → Campaign → Stats → Store
- **Observable Support**: IP, Domain, URL, Hash (MD5/SHA1/SHA256), CVE, Actor, Malware
- **MITRE ATT&CK Mapping**: Automatic tactic/technique mapping from ingested intelligence

### Dashboard
- **KPI Cards**: Critical Alerts, IOCs, Assets Affected, Active Campaigns
- **Threat Pulse**: Real-time 5-metric strip (Intel, CVEs, Leaks, Phishing, Malware)
- **Severity Distribution**: Pie chart of threat severity breakdown
- **Threat Timeline**: Line chart trending threats over time
- **Risk Score Overview**: Circular gauge with contributing factors
- **MITRE ATT&CK Heatmap**: 12-tactic coverage visualization
- **Triage Queue**: Priority-sorted items by asset relevance × risk score
- **Top IOCs**: Top 10 indicators of compromise
- **Top Attacked Assets**: Bar chart of most targeted assets
- **Recent Alerts**: Latest triggered detection rules
- **Feed Status**: Health of all configured intelligence feeds
- **Top Countries/CVEs**: Geographic and vulnerability rankings

### Core Modules
- **Intel Feed**: Real-time threat feed with severity/source/asset filters + CSV/HTML/JSON export
- **Global Search**: Full-text search across all intelligence data
- **Assets**: Define domains, IPs, ASNs, brands, emails for monitoring
- **Sources**: 20+ pre-configured OSINT feeds with enable wizard and health monitoring
- **Leak Hub**: Credential, paste, breach, code leak monitoring
- **Graph Explorer**: Entity-relationship visualization
- **Global Threat Monitoring**: Interactive 3D globe + 2D map with real-time WebSocket stream
- **Alerts**: Detection rules with Slack/Teams/Email/Webhook notification channels
- **Cases**: Case management with SLA tracking
- **Investigations**: Notebook workspace for analysis
- **Reports**: Template-based export (Daily Brief, Weekly, Executive, Leak, Vulnerability)
- **Playbooks**: Low-code automation engine (enrich, notify, create case, webhook)

### Security
- JWT auth with 30-min access / 7-day refresh tokens
- Role-Based Access: `system_owner` | `team_admin` | `team_member` | `user`
- Rate limiting (Redis-backed for multi-worker)
- Brute-force detection with lockout
- SSRF protection on source fetching
- Full audit logging on all state-changing actions

---

## 🚀 Quick Start

### Prerequisites
- **Docker**: Docker Engine 20+ and Docker Compose v2
- **OR** Python 3.12+, Node.js 20+, PostgreSQL 16+, Redis 7+

### Method 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/catshy.git
cd catshy

# Copy environment file
cp deploy/.env.example .env

# Edit .env with your settings (especially JWT_SECRET)
nano .env

# Start everything
docker-compose up -d

# Access the application
# Frontend: http://localhost
# API:      http://localhost:8080
# API Docs: http://localhost:8080/docs
```

### Method 2: Manual (Kali Linux)

```bash
# 1. Install system dependencies
sudo apt update && sudo apt install -y python3.12 python3.12-venv postgresql redis nodejs npm nginx

# 2. Setup PostgreSQL
sudo -u postgres createdb catshy
sudo -u postgres psql -c "CREATE USER catshy WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE catshy TO catshy;"

# 3. Setup Backend
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Configure environment
cp ../deploy/.env.example ../.env
# Edit ../.env with your database credentials and secrets

# 5. Run database migrations
alembic upgrade head

# 6. Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 2

# 7. Start Celery (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info &
celery -A app.tasks.celery_app beat --loglevel=info &

# 8. Setup Frontend
cd ..
npm install
npm run build

# 9. Configure Nginx
sudo cp deploy/nginx-catshy.conf /etc/nginx/sites-available/catshy
sudo ln -s /etc/nginx/sites-available/catshy /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Method 3: Manual (Windows)

```powershell
# 1. Install prerequisites
# - Python 3.12: https://python.org
# - Node.js 20: https://nodejs.org
# - PostgreSQL 16: https://postgresql.org
# - Redis (via WSL or Memurai): https://memurai.com

# 2. Setup Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Setup environment
copy ..\deploy\.env.example ..\.env
# Edit .env with your settings

# 4. Run migrations & start
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8080

# 5. Start Celery (separate terminal)
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo

# 6. Frontend
cd ..
npm install
npm run dev
```

---

## 🔐 Default Credentials

| Setting | Default Value |
|---------|-------------|
| Admin Email | `admin@catshy.local` |
| Admin Password | `AdminPass123!` |
| API URL | `http://localhost:8080` |
| Frontend URL | `http://localhost` (Docker) / `http://localhost:5173` (dev) |

> ⚠️ **Change default credentials immediately in production!**

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|---------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/signup` | Register new account |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/invite` | Invite user (admin only) |
| POST | `/api/auth/change-password` | Change password |

### Intelligence
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/threats/feed` | Get threat feed (< 24h) |
| GET | `/api/threats/history` | Get threat history (24h–30d) |
| WS | `/api/threats/stream` | Real-time threat WebSocket |
| GET | `/api/search/` | Full-text search |

### Dashboard
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/dashboard/kpis` | KPI metrics |
| GET | `/api/dashboard/live-feed` | Live feed items |
| GET | `/api/dashboard/pulse` | Threat pulse metrics |
| GET | `/api/dashboard/changes` | What changed data |
| GET | `/api/dashboard/severity` | Severity distribution |
| GET | `/api/dashboard/timeline` | Threat timeline |
| GET | `/api/dashboard/top-iocs` | Top IOCs |
| GET | `/api/dashboard/risk-score` | Risk score overview |
| GET | `/api/dashboard/recent-alerts` | Recent alerts |
| GET | `/api/dashboard/feed-status` | Feed health status |
| GET | `/api/dashboard/mitre` | MITRE ATT&CK data |
| GET | `/api/dashboard/attacked-assets` | Top attacked assets |

### Resources (CRUD)
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET/POST | `/api/assets/` | Asset management |
| GET/POST | `/api/sources/` | Source management |
| GET/POST | `/api/alerts/rules` | Alert rules |
| GET/POST | `/api/cases/` | Case management |
| GET/POST | `/api/reports/` | Report generation |
| GET | `/api/leaks/` | Leak monitoring |
| GET | `/api/entities/` | Entity graph |

### System
| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/admin/users` | User management |
| GET | `/api/admin/audit-logs` | Audit trail |

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|---------|
| **Can't connect to database** | Check `DATABASE_URL` in `.env`, ensure PostgreSQL is running |
| **Redis connection refused** | Ensure Redis is running on configured port |
| **CORS errors** | Add your frontend URL to `CORS_EXTRA_ORIGINS` in `.env` |
| **JWT errors** | Ensure `JWT_SECRET` is set and consistent across restarts |
| **Celery not processing** | Check Redis connectivity and Celery worker logs |
| **Frontend blank page** | Check browser console, ensure API URL is correct in `.env` |
| **Docker build fails** | Ensure Docker has sufficient memory (4GB+) |

---

## 📂 Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components (dashboard/, layout/, ui/)
│   ├── contexts/           # React contexts (Auth)
│   ├── hooks/              # Custom hooks (useApi, useAuth)
│   ├── pages/              # Route pages (20+ pages)
│   └── types/              # TypeScript interfaces
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── core/           # Security, dependencies
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routers/        # API endpoints
│   │   ├── services/       # Business logic
│   │   └── tasks/          # Celery background tasks
│   └── alembic/            # Database migrations
├── deploy/                 # Deployment configs
├── docker-compose.yml      # Docker orchestration
├── Dockerfile              # Multi-stage build
└── .cursorrules            # Cursor AI project rules
```

---

## 📜 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  <strong>CATSHY</strong> — Cybersecurity Automated Threat Surveillance & Hunting Yielder<br/>
  Built for SOC analysts, threat hunters, and security teams.
</p>
