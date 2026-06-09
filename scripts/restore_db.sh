#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${1:?Usage: scripts/restore_db.sh backups/file.sql.gz}"
gunzip -c "$1" | psql "$DATABASE_URL"
