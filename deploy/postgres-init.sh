#!/bin/sh
set -eu
# The official image creates POSTGRES_USER as superuser. Keep it as owner of
# this application's database, but remove cluster administration privileges.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_user="$POSTGRES_USER" <<'SQL'
ALTER ROLE :"app_user" NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SQL
