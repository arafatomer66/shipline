#!/bin/bash
# Shipline deploy on a fresh Amazon Linux 2023 instance.
# Assumes Docker, Node 22, nginx, and git are already installed (via the
# EC2 user-data bootstrap or `dnf install`). Idempotent — safe to re-run.
#
# Required env vars:
#   ADMIN_PASSWORD   (Basic Auth password — must be set; no default for safety)
#
# Optional env vars:
#   ADMIN_USER       (default: admin)
#   REPO_URL         (default: https://github.com/arafatomer66/shipline.git)
#   PUBLIC_HOST      (default: detected from instance metadata — the public IP
#                     or the domain. Used as the cert CN/SAN and in nginx.)
#
# Usage:
#   ADMIN_PASSWORD='your-strong-password' bash deploy-ec2.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/arafatomer66/shipline.git}"
APP_DIR="/home/ec2-user/shipline"
ADMIN_USER="${ADMIN_USER:-admin}"

# Detect public IP if PUBLIC_HOST not supplied (used for the self-signed cert SAN).
if [ -z "${PUBLIC_HOST:-}" ]; then
  TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
  PUBLIC_HOST=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/public-ipv4 || echo "_")
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: ADMIN_PASSWORD is required. Re-run with:" >&2
  echo "  ADMIN_PASSWORD='your-strong-password' bash $0" >&2
  exit 1
fi

log() { echo "[$(date +%H:%M:%S)] $*"; }

# 0) Swap (t3.micro has 1 GB RAM; Angular build will OOM without it).
if ! swapon --show=NAME --noheadings | grep -q swapfile; then
  log "Creating 4 GB swap"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q "^/swapfile" /etc/fstab || echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# 1) Clone or update
if [ ! -d "$APP_DIR" ]; then
  log "Cloning repo"
  git clone "$REPO_URL" "$APP_DIR"
else
  log "Pulling latest"
  (cd "$APP_DIR" && git pull --ff-only)
fi
cd "$APP_DIR"

# 2) Postgres via docker compose
log "Starting Postgres"
sg docker -c "docker compose up -d postgres"
log "Waiting for Postgres ready"
for i in $(seq 1 60); do
  if sg docker -c "docker compose exec -T postgres pg_isready -U shipline" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# 3) API
log "Installing API deps"
cd "$APP_DIR/api"
if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL=postgresql://shipline:shipline@localhost:5438/shipline?schema=public
PORT=3001
EOF
fi
NODE_OPTIONS="--max-old-space-size=1536" npm install --no-audit --no-fund --silent
log "Running Prisma migrate deploy"
npx prisma migrate deploy
log "Building API"
NODE_OPTIONS="--max-old-space-size=1536" npx nest build

# 4) Web
log "Installing Web deps"
cd "$APP_DIR/web"
NODE_OPTIONS="--max-old-space-size=1536" npm install --no-audit --no-fund --silent

# Rewrite the dev API base to /api so nginx proxies it on prod
if grep -q "http://localhost:3001/api" src/app/api.service.ts; then
  log "Rewriting API base URL to '/api' for production build"
  sed -i 's|http://localhost:3001/api|/api|g' src/app/api.service.ts
fi
if grep -q "http://localhost:3001/api/projects" src/app/pages/project.page.ts 2>/dev/null; then
  sed -i 's|http://localhost:3001/api/projects|/api/projects|g' src/app/pages/project.page.ts
fi

log "Building Angular (~30 sec on t3.micro with swap)"
NODE_OPTIONS="--max-old-space-size=1536" npx ng build --configuration production

WEB_DIST=$(find "$APP_DIR/web/dist" -name index.html -path '*/browser/*' -print -quit | xargs dirname || true)
[ -z "$WEB_DIST" ] && WEB_DIST=$(find "$APP_DIR/web/dist" -name index.html -print -quit | xargs dirname || true)
log "Web dist at: $WEB_DIST"

# 5) systemd unit for API
log "Installing systemd unit for shipline-api"
sudo tee /etc/systemd/system/shipline-api.service >/dev/null <<EOF
[Unit]
Description=Shipline NestJS API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=$APP_DIR/api
EnvironmentFile=$APP_DIR/api/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable shipline-api
sudo systemctl restart shipline-api

# 6) Basic auth (htpasswd file)
log "Setting up basic auth (user=$ADMIN_USER)"
sudo dnf install -y httpd-tools >/dev/null 2>&1
sudo htpasswd -bc /etc/nginx/.htpasswd "$ADMIN_USER" "$ADMIN_PASSWORD"
sudo chmod 640 /etc/nginx/.htpasswd
sudo chown root:nginx /etc/nginx/.htpasswd

# 7) Strip AL2023's default embedded server block in nginx.conf (otherwise it
#    wins as the default server and our shipline.conf gets ignored for the
#    root site name).
if sudo grep -qE '^\s*server\s*\{' /etc/nginx/nginx.conf; then
  log "Removing default server block from nginx.conf"
  sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%s) 2>/dev/null || true
  sudo python3 - <<'PY'
import re, pathlib
p = pathlib.Path('/etc/nginx/nginx.conf')
src = p.read_text()
# Match a top-level "server { ... }" block (single-level brace nesting allowed).
# AL2023's stock block contains nested location blocks, so balance braces.
def strip_first_server(s):
    i = s.find('server {')
    if i < 0:
        # try alternate spacing
        m = re.search(r'\n\s*server\s*\{', s)
        if not m:
            return s
        i = m.end() - 1
    depth = 0
    j = i
    while j < len(s):
        ch = s[j]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                # consume optional trailing newline
                end = j + 1
                while end < len(s) and s[end] in ' \t\n':
                    end += 1
                return s[:i] + s[end:]
        j += 1
    return s
p.write_text(strip_first_server(src))
PY
fi

# 8) Self-signed TLS cert (Let's Encrypt won't issue for *.compute.amazonaws.com).
#    Browsers will warn the first visit; click through once.
if [ ! -f /etc/nginx/ssl/shipline.crt ]; then
  log "Generating self-signed cert (CN=$PUBLIC_HOST, 825-day validity)"
  sudo mkdir -p /etc/nginx/ssl
  # If PUBLIC_HOST looks like an IP, put it in the SAN as IP:, else as DNS:.
  if [[ "$PUBLIC_HOST" =~ ^[0-9.]+$ ]]; then
    SAN_LINE="IP:$PUBLIC_HOST"
  else
    SAN_LINE="DNS:$PUBLIC_HOST"
  fi
  sudo openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/shipline.key \
    -out  /etc/nginx/ssl/shipline.crt \
    -days 825 \
    -subj "/CN=$PUBLIC_HOST/O=Shipline" \
    -addext "subjectAltName=$SAN_LINE" 2>&1 | tail -1
  sudo chmod 600 /etc/nginx/ssl/shipline.key
  sudo chmod 644 /etc/nginx/ssl/shipline.crt
fi

# 9) shipline.conf — HTTP → HTTPS redirect, HTTPS does Angular + /api proxy + auth
log "Configuring nginx"
sudo tee /etc/nginx/conf.d/shipline.conf >/dev/null <<EOF
# Redirect HTTP -> HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/shipline.crt;
    ssl_certificate_key /etc/nginx/ssl/shipline.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root $WEB_DIST;
    index index.html;

    auth_basic           "Shipline";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Health endpoint stays open so uptime checks work without creds
    location = /api/health {
        auth_basic off;
        proxy_pass http://127.0.0.1:3001/api/health;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 25m;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
sudo rm -f /etc/nginx/conf.d/default.conf
sudo chmod o+rx /home/ec2-user
sudo chmod -R o+rX "$WEB_DIST"
sudo nginx -t
sudo systemctl reload nginx

log "Deployment complete."
echo
echo "  API health (no auth):  curl http://localhost/api/health"
echo "  App:                   open http://<public-ip>/ and login as $ADMIN_USER"
