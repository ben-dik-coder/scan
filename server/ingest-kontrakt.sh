#!/usr/bin/env bash
# PDF → Supabase contract_chunks. Krever server/.env (OPENAI + Supabase).
# Bruk:
#   ./ingest-kontrakt.sh "/sti/til/kontrakt.pdf"
#   ./ingest-kontrakt.sh --clear "/sti/til/kontrakt.pdf"
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
if [ "${1:-}" = "" ]; then
  echo "Bruk: ./ingest-kontrakt.sh [--clear] \"/sti/til/kontrakt.pdf\""
  exit 1
fi
npm run ingest-contract-pdf -- "$@"
