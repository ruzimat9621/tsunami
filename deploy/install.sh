#!/usr/bin/env bash
# Fason hisob — OVH (Ubuntu/Debian) serverga o'rnatish yoki yangilash.
# Ishlatish:  sudo bash install.sh [domen]
#   domen berilmasa — serverning IP manzilidan avtomatik: 51-75-1-2.sslip.io
set -euo pipefail

REPO="https://github.com/ruzimat9621/tsunami.git"
DIR="/opt/fason-hisob"
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then echo "sudo bilan ishga tushiring: sudo bash $0 $*"; exit 1; fi

command -v git >/dev/null && command -v curl >/dev/null || { apt-get update -y && apt-get install -y git curl; }
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
mkdir -p "$DIR/data"

if [ -z "$DOMAIN" ] && [ -f "$DIR/deploy/.env" ]; then
  DOMAIN="$(grep -E '^DOMAIN=' "$DIR/deploy/.env" | cut -d= -f2-)"
fi
if [ -z "$DOMAIN" ]; then
  IP="$(curl -fsS4 https://api.ipify.org || curl -fsS4 https://ifconfig.me)"
  DOMAIN="${IP//./-}.sslip.io"
fi
echo "DOMAIN=$DOMAIN" > "$DIR/deploy/.env"

# Server xavfsizlik devori (ufw) yoqilgan bo'lsa — 80 va 443 ni ochamiz
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp && ufw allow 443/tcp
fi

cd "$DIR/deploy"

# 80-portni kim egallagan? (bizning caddy bo'lsa — hisobga olmaymiz)
port80="$(ss -ltnpH 'sport = :80' 2>/dev/null || true)"
ours_caddy="$(docker compose --profile caddy ps -q caddy 2>/dev/null || true)"

if [ -z "$port80" ] || [ -n "$ours_caddy" ]; then
  echo "▶ 80-port bo'sh — Caddy (avtomatik HTTPS) bilan ishga tushiramiz"
  docker compose --profile caddy up -d
  docker compose restart app
elif echo "$port80" | grep -q nginx; then
  echo "▶ Serverda nginx ishlayapti — ilovani nginx orqali ulaymiz (boshqa saytlarga tegilmaydi)"
  docker compose --profile caddy rm -sf caddy >/dev/null 2>&1 || true   # avvalgi urinishdan qolgan bo'lsa
  docker compose up -d app
  docker compose restart app
  CONF="/etc/nginx/sites-available/$DOMAIN"
  if [ ! -f "$CONF" ]; then
    cat > "$CONF" <<NGINX
# Fason hisob — install.sh tomonidan yaratilgan
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 30m;
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_buffering off;          # jonli yangilanish (SSE)
        proxy_read_timeout 1h;
    }
}
NGINX
    mkdir -p /etc/nginx/sites-enabled
    ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN"
    if ! nginx -t; then
      echo "❌ nginx konfiguratsiyasida xato — o'zgarish bekor qilindi"
      rm -f "/etc/nginx/sites-enabled/$DOMAIN" "$CONF"
      exit 1
    fi
    systemctl reload nginx
  fi
  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    command -v certbot >/dev/null || { apt-get update -y && apt-get install -y certbot python3-certbot-nginx; }
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
      || echo "⚠️ HTTPS sertifikati olinmadi (DNS hali tarqalmagan bo'lishi mumkin). Keyinroq deploy ni qayta ishga tushiring."
  fi
else
  echo "❌ 80-portni boshqa dastur egallagan — avtomatik ulay olmayman:"
  echo "$port80"
  echo "Ilova baribir ishga tushirildi: 127.0.0.1:8090 (shu manzilga o'zingizning veb-serveringizdan proxy qiling)."
  docker compose up -d app
  docker compose restart app
  exit 1
fi

echo
echo "✅ Tayyor!  Ilova manzili:  https://$DOMAIN"
echo "   (HTTPS sertifikati 1-2 daqiqada tayyor bo'ladi)"
echo "   Ma'lumotlar: $DIR/data  (kunlik zaxiralar: $DIR/data/backups)"
echo "   Yangilash uchun shu buyruqni qayta ishga tushiring."
