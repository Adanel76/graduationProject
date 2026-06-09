#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p backups
pg_dump "$DATABASE_URL" | gzip > "backups/tourism_$(date +%Y%m%d_%H%M%S).sql.gz"
