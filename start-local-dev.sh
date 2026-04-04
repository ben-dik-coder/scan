#!/usr/bin/env bash
# Start API (8787) + Vite i én terminal. Ctrl+C stopper begge.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "==> Starter Scanix API (server/) på port 8787 i bakgrunnen …"
(cd "$ROOT/server" && npm start) &
API_PID=$!

cleanup() {
  echo ""
  echo "==> Stopper API (PID $API_PID) …"
  kill "$API_PID" 2>/dev/null || true
  wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Venter på at API svarer (første oppstart kan ta 30–90 s) …"
HEALTH_OK=0
for _ in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:8787/api/health" >/dev/null 2>&1; then
    echo "==> API er oppe: http://127.0.0.1:8787/api/health"
    HEALTH_OK=1
    break
  fi
  sleep 1
done
if [ "$HEALTH_OK" != 1 ]; then
  echo "==> ADVARSEL: Fikk ikke svar fra API etter 120 s. Sjekk server/.env og feil over."
  echo "    Starter Vite likevel – kontrakt/AI virker ikke før API kjører."
fi

echo ""
echo "==> Starter Vite. Vent noen sekunder til «Local:» vises under."
echo ""
npm run dev
