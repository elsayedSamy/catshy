# ── CATSHY Backend Dockerfile ──
FROM python:3.12-slim AS backend

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY backend/ .

# Non-root user
RUN useradd -m -r catshy && chown -R catshy:catshy /app
USER catshy

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]

# ── Frontend build stage ──
FROM node:20-slim AS frontend-build

WORKDIR /app
COPY package.json bun.lock* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install
COPY . .
RUN npm run build

# ── Frontend serve stage ──
FROM nginx:alpine AS frontend

COPY --from=frontend-build /app/dist /usr/share/nginx/html
COPY deploy/nginx-catshy.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
