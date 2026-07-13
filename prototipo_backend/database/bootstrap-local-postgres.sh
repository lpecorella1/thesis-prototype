#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
DEFAULT_PSQL="/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
PSQL_BIN="${PSQL_BIN:-$DEFAULT_PSQL}"
DB_NAME="${DB_NAME:-nutritrack}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RESET_DB="${RESET_DB:-0}"
MIGRATION_PATH="$SCRIPT_DIR/migrations/001_postgres_base.sql"

if [ ! -x "$PSQL_BIN" ]; then
  echo "psql non trovato: $PSQL_BIN" >&2
  echo "Imposta PSQL_BIN oppure aggiungi Postgres al PATH." >&2
  exit 1
fi

echo "Uso psql: $PSQL_BIN"
echo "Controllo connessione a $DB_HOST:$DB_PORT..."

if ! "$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
  echo "Postgres non risponde oppure credenziali non valide." >&2
  echo "Avvia Postgres.app o correggi DB_HOST/DB_PORT/DB_USER prima di riprovare." >&2
  exit 1
fi

echo "Creo il database $DB_NAME se non esiste..."
DATABASE_EXISTS=0
if "$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
  DATABASE_EXISTS=1
fi

if [ "$RESET_DB" = "1" ] && [ "$DATABASE_EXISTS" = "1" ]; then
  echo "RESET_DB=1: elimino e ricreo il database $DB_NAME..."
  "$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE $DB_NAME WITH (FORCE)"
  DATABASE_EXISTS=0
fi

if [ "$DATABASE_EXISTS" = "0" ]; then
  "$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"
fi

echo "Applico la migrazione iniziale..."
"$PSQL_BIN" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION_PATH"

echo "Bootstrap completato per il database $DB_NAME."
