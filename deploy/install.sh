#!/usr/bin/env bash
# Fason hisob — OVH (Ubuntu/Debian) serverga o'rnatish yoki yangilash.
# Ishlatish:  sudo bash install.sh [domen]
#   domen berilmasa — serverning IP manzilidan avtomatik: 51-75-1-2.sslip.io
set -euo pipefail

REPO="https://github.com/ruzimat9621/tsunami.git"
DIR="/opt/fason-hisob"
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then echo "sudo bilan ishga tushiring: sudo bash $0 $*"; exit 1; fi

command -v git >/dev/null || { apt-get update -y && apt-get install -y git curl; }
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
docker compose up -d
docker compose restart app   # yangi kodni yuklash

echo
echo "✅ Tayyor!  Ilova manzili:  https://$DOMAIN"
echo "   (HTTPS sertifikati 1-2 daqiqada tayyor bo'ladi)"
echo "   Ma'lumotlar: $DIR/data  (kunlik zaxiralar: $DIR/data/backups)"
echo "   Yangilash uchun shu buyruqni qayta ishga tushiring."
