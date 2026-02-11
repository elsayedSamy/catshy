#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# CATSHY — Install Script for Kali Linux (Native, No Docker)
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

CATSHY_HOME="/opt/catshy"
CATSHY_USER="catshy"
DB_NAME="catshy"
DB_USER="catshy"
DB_PASS=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
REDIS_PASS=$(openssl rand -hex 16)

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   CATSHY — Threat Intelligence Platform ║"
echo "  ║   Native Install for Kali Linux         ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── Check root ──
if [ "$EUID" -ne 0 ]; then err "Run as root: sudo bash install.sh"; fi

# ── System packages ──
info "Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq \
    python3 python3-pip python3-venv python3-dev \
    postgresql postgresql-contrib \
    redis-server \
    nginx \
    build-essential libpq-dev libffi-dev \
    libcairo2-dev libpango1.0-dev libgdk-pixbuf2.0-dev \
    curl git openssl jq

ok "System packages installed"

# ── Node.js (for frontend build) ──
if ! command -v node &> /dev/null; then
    info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
ok "Node.js $(node -v) available"

# ── Create system user ──
if ! id "$CATSHY_USER" &>/dev/null; then
    useradd --system --home "$CATSHY_HOME" --shell /bin/false "$CATSHY_USER"
    ok "Created system user: $CATSHY_USER"
fi

# ── Create directories ──
mkdir -p "$CATSHY_HOME"/{backend,frontend,logs,reports,data}
cp -r ./backend/* "$CATSHY_HOME/backend/"
cp -r ./src ./public ./index.html ./vite.config.ts ./tsconfig*.json ./tailwind.config.ts ./postcss.config.js ./package.json ./components.json "$CATSHY_HOME/frontend/" 2>/dev/null || true

# ── PostgreSQL Setup ──
info "Configuring PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS unaccent;"

# Harden PostgreSQL
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)
if ! grep -q "$DB_USER" "$PG_HBA" 2>/dev/null; then
    echo "local   $DB_NAME   $DB_USER   scram-sha-256" >> "$PG_HBA"
    systemctl reload postgresql
fi
ok "PostgreSQL configured (db=$DB_NAME, user=$DB_USER)"

# ── Redis Setup ──
info "Configuring Redis..."
systemctl enable redis-server
REDIS_CONF="/etc/redis/redis.conf"
sed -i "s/^# requirepass .*/requirepass $REDIS_PASS/" "$REDIS_CONF"
sed -i "s/^requirepass .*/requirepass $REDIS_PASS/" "$REDIS_CONF"
sed -i "s/^bind .*/bind 127.0.0.1 ::1/" "$REDIS_CONF"
systemctl restart redis-server
ok "Redis configured with password"

# ── Python Virtual Environment ──
info "Setting up Python environment..."
python3 -m venv "$CATSHY_HOME/backend/venv"
source "$CATSHY_HOME/backend/venv/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$CATSHY_HOME/backend/requirements.txt"
ok "Python dependencies installed"

# ── Environment File ──
info "Generating .env file..."
cat > "$CATSHY_HOME/backend/.env" << EOF
# CATSHY Configuration — Generated $(date)
DATABASE_URL=postgresql+asyncpg://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
DATABASE_URL_SYNC=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
REDIS_URL=redis://:$REDIS_PASS@localhost:6379/0
CELERY_BROKER_URL=redis://:$REDIS_PASS@localhost:6379/1
CELERY_RESULT_BACKEND=redis://:$REDIS_PASS@localhost:6379/2
JWT_SECRET=$JWT_SECRET
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["http://localhost","http://127.0.0.1","https://$(hostname -f)"]
SSRF_DENY_PRIVATE=true
SSRF_TIMEOUT=15
ENABLE_TOR=false
REPORT_COMPANY_NAME=CATSHY
EOF
ok ".env file created"

# ── Database Migrations ──
info "Running database migrations..."
cd "$CATSHY_HOME/backend"
source venv/bin/activate
export $(grep -v '^#' .env | xargs)
python3 -c "
from app.database import engine, Base
from app.models import *
import asyncio
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created')
asyncio.run(init())
"
ok "Database tables created"

# ── Initialize Source Catalog ──
info "Initializing source catalog..."
python3 -c "
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import Source
import json, os
engine = create_engine(os.getenv('DATABASE_URL_SYNC'))
with open('sources.default.json') as f:
    catalog = json.load(f)
with Session(engine) as db:
    for entry in catalog:
        if not db.query(Source).filter(Source.id == entry['id']).first():
            db.add(Source(**entry))
    db.commit()
    print(f'Loaded {len(catalog)} source templates (all disabled)')
"
ok "Source catalog initialized"

# ── Bootstrap Admin User ──
info "Creating admin user..."
read -p "Admin email: " ADMIN_EMAIL
read -p "Admin name: " ADMIN_NAME
read -sp "Admin password: " ADMIN_PASS
echo
python3 -c "
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models import User
from passlib.context import CryptContext
import os
pwd = CryptContext(schemes=['bcrypt'])
engine = create_engine(os.getenv('DATABASE_URL_SYNC'))
with Session(engine) as db:
    if not db.query(User).filter(User.email == '$ADMIN_EMAIL').first():
        db.add(User(email='$ADMIN_EMAIL', name='$ADMIN_NAME', hashed_password=pwd.hash('$ADMIN_PASS'), role='admin'))
        db.commit()
        print('Admin user created')
    else:
        print('Admin user already exists')
"
ok "Admin user configured"

# ── Build Frontend ──
info "Building frontend..."
cd "$CATSHY_HOME/frontend"
npm install --silent
npx vite build --outDir "$CATSHY_HOME/frontend/dist"
ok "Frontend built"

# ── Install systemd services ──
info "Installing systemd services..."
cp /opt/catshy/deploy/catshy-api.service /etc/systemd/system/
cp /opt/catshy/deploy/catshy-celery-worker.service /etc/systemd/system/
cp /opt/catshy/deploy/catshy-celery-beat.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable catshy-api catshy-celery-worker catshy-celery-beat
systemctl start catshy-api catshy-celery-worker catshy-celery-beat
ok "Services installed and started"

# ── Nginx Setup ──
info "Configuring Nginx..."
cp /opt/catshy/deploy/nginx-catshy.conf /etc/nginx/sites-available/catshy
ln -sf /etc/nginx/sites-available/catshy /etc/nginx/sites-enabled/catshy
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
ok "Nginx configured"

# ── Set permissions ──
chown -R "$CATSHY_USER":"$CATSHY_USER" "$CATSHY_HOME"
chmod 600 "$CATSHY_HOME/backend/.env"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN} CATSHY installed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Web UI:      ${CYAN}http://localhost${NC}"
echo -e "  API:         ${CYAN}http://localhost/api/health${NC}"
echo -e "  Admin:       ${CYAN}$ADMIN_EMAIL${NC}"
echo ""
echo -e "  DB Password: ${YELLOW}$DB_PASS${NC}"
echo -e "  JWT Secret:  ${YELLOW}$JWT_SECRET${NC}"
echo -e "  Redis Pass:  ${YELLOW}$REDIS_PASS${NC}"
echo ""
echo -e "  ${YELLOW}Save these credentials securely!${NC}"
echo -e "  They are stored in: $CATSHY_HOME/backend/.env"
echo ""
echo -e "  Logs: journalctl -u catshy-api -f"
echo -e "  Logs: journalctl -u catshy-celery-worker -f"
echo ""

# ── Hardening Notes ──
cat << 'HARDENING'

═══ HARDENING NOTES ═══

1. FIREWALL:
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw enable

2. SSL/TLS (recommended):
   apt install certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com

3. POSTGRESQL:
   - Password authentication is enforced
   - Only local connections allowed by default
   - To allow remote: edit pg_hba.conf and postgresql.conf

4. REDIS:
   - Password-protected, bound to localhost only
   - Consider enabling TLS for production

5. SECRETS:
   - .env file is chmod 600, owned by catshy user
   - Rotate JWT_SECRET periodically
   - Use strong passwords for all services

6. UPDATES:
   apt update && apt upgrade -y
   cd /opt/catshy/backend && source venv/bin/activate && pip install -U -r requirements.txt

HARDENING
