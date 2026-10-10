#!/bin/bash
set -euo pipefail

: "${YABE_INDEXER_PASSWORD:?YABE_INDEXER_PASSWORD must be set}"
: "${YABE_API_PASSWORD:?YABE_API_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v db="$POSTGRES_DB" \
  -v indexer_password="$YABE_INDEXER_PASSWORD" \
  -v api_password="$YABE_API_PASSWORD" <<'EOSQL'
CREATE ROLE yabe_indexer LOGIN PASSWORD :'indexer_password';
CREATE ROLE yabe_api LOGIN PASSWORD :'api_password';

GRANT CONNECT ON DATABASE :"db" TO yabe_indexer, yabe_api;
GRANT USAGE, CREATE ON SCHEMA public TO yabe_indexer;
GRANT USAGE ON SCHEMA public TO yabe_api;

ALTER DEFAULT PRIVILEGES FOR ROLE yabe_indexer IN SCHEMA public
  GRANT SELECT ON TABLES TO yabe_api;
EOSQL
