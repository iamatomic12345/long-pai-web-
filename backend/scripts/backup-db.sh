#!/usr/bin/env bash
# Back up the Long Pai database (the public schema on Supabase) to a dated .sql file.
#
# Usage (WSL, Git Bash, Linux or macOS), from the repo root:
#   bash backend/scripts/backup-db.sh [out_dir]
#
# It asks for the connection string without echoing it (or reads $DATABASE_URL if set).
# Needs pg_dump of the same or newer major version as Supabase's Postgres.
# Default out_dir: /mnt/c/Users/thiti/Downloads/longpai-backups under WSL, else ~/Downloads/longpai-backups
#
# Restore (replaces the tables in the public schema with the backup):
#   psql "<connection string>" -v ON_ERROR_STOP=1 -f <file>.sql
set -euo pipefail

if [ -n "${1:-}" ]; then
  out_dir="$1"
elif [ -d /mnt/c/Users/thiti ]; then
  out_dir=/mnt/c/Users/thiti/Downloads/longpai-backups
else
  out_dir="$HOME/Downloads/longpai-backups"
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. On Ubuntu/WSL: sudo apt install postgresql-client (see the README for matching versions)" >&2
  exit 1
fi

url="${DATABASE_URL:-}"
if [ -z "$url" ]; then
  read -r -s -p "Supabase connection string (Session pooler URI; input is hidden): " url
  echo
fi
[ -n "$url" ] || { echo "No connection string given." >&2; exit 1; }

# the app's ?sslmode=no-verify is a node-postgres setting; libpq (pg_dump) calls it "require"
url="${url//sslmode=no-verify/sslmode=require}"

mkdir -p "$out_dir"
file="$out_dir/longpai-$(date +%Y-%m-%d_%H%M).sql"

# public schema only (Supabase's own auth/storage schemas aren't ours to restore);
# --clean --if-exists makes the file drop and recreate each table when restored
if ! pg_dump --dbname="$url" --schema=public --no-owner --no-privileges --clean --if-exists --file="$file"; then
  rm -f "$file"
  echo "pg_dump failed. If it mentions a server version mismatch, install a newer PostgreSQL client." >&2
  exit 1
fi

echo "Backup written: $file ($(du -h "$file" | cut -f1))"
