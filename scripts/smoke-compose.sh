#!/usr/bin/env bash
# Disposable integration environment only. Never run this script against production.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
umask 077
scratch=$(mktemp -d)
export POSTGRES_DB=paytrack_smoke POSTGRES_USER=paytrack_smoke
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB"
export FRONTEND_ORIGIN=https://localhost:18443 SITE_ADDRESS=localhost
export HTTP_PORT=18080 HTTPS_PORT=18443 HTTPS_REDIRECT_PORT=18081 TLS_BIND_IP=127.0.0.1
export IMAGE_TAG=smoke BACKEND_IMAGE=paytrack-backend FRONTEND_IMAGE=paytrack-frontend
export SMOKE_PASSWORD="$(openssl rand -hex 10)"
export SMOKE_URL="$FRONTEND_ORIGIN" SMOKE_CA="$scratch/root.crt"
export DATABASE_SSL=disable COOKIE_SAME_SITE=strict VITE_API_URL=/api
if [[ "${GITHUB_ACTIONS:-}" == true ]]; then
  echo "::add-mask::$POSTGRES_PASSWORD"
  echo "::add-mask::$SMOKE_PASSWORD"
fi
compose=(docker compose --env-file /dev/null -p paytrack-smoke -f compose.yaml -f compose.tls.yaml)
cleanup() {
  local result=$?
  trap - EXIT
  "${compose[@]}" down -v --remove-orphans
  rm -f "$scratch/root.crt"
  rmdir "$scratch"
  exit "$result"
}
trap cleanup EXIT
"${compose[@]}" config --quiet
"${compose[@]}" build backend frontend
"${compose[@]}" up -d --wait --wait-timeout 180
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" run --rm --no-deps backend node database/check.js
for i in {1..30}; do
  if "${compose[@]}" cp tls:/data/caddy/pki/authorities/local/root.crt "$SMOKE_CA"; then break; fi
  sleep 2
done
curl --cacert "$SMOKE_CA" --fail --silent --show-error --retry 15 --retry-all-errors --retry-delay 2 "$SMOKE_URL/api/health"
"${compose[@]}" exec -T -e SMOKE_PASSWORD backend node --input-type=module <<'JS'
import { openDatabase, closeDatabase } from './src/config/database.js';
import { createMaster } from './src/modules/auth/auth.service.js';
try {
  await openDatabase();
  await createMaster({name:'Smoke test',email:'smoke@example.test',cpf:'52998224725',password:process.env.SMOKE_PASSWORD});
} finally { await closeDatabase(); }
JS
node scripts/smoke-http.mjs
# Verify non-root runtimes, no public database/API ports and no secrets in images.
for service in backend frontend postgres tls; do
  [[ "$("${compose[@]}" exec -T "$service" id -u)" != 0 ]]
done
for service in backend postgres; do
  id=$("${compose[@]}" ps -q "$service")
  [[ "$(docker inspect -f '{{len .HostConfig.PortBindings}}' "$id")" == 0 ]]
done
"${compose[@]}" exec -T backend node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
for (const path of ['.env','tests','database/seed.js','database/paytrack.db','node_modules/better-sqlite3']) assert.equal(existsSync(path),false,path);
JS
status=$(curl --silent -o /dev/null -w '%{http_code}' -H 'X-Forwarded-Proto: https' http://127.0.0.1:18080/api/health)
[[ "$status" == 426 ]]
"${compose[@]}" stop postgres
"${compose[@]}" exec -T backend node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.status===503?0:1))"
"${compose[@]}" up -d --wait postgres
"${compose[@]}" restart backend frontend
"${compose[@]}" up -d --wait --wait-timeout 120
node scripts/smoke-http.mjs
# down without -v must retain users, passwords and sessions on the named volume.
"${compose[@]}" down
"${compose[@]}" up -d --wait --wait-timeout 180
SMOKE_CHECK_RATE_LIMIT=1 node scripts/smoke-http.mjs
echo 'Compose production smoke test passed.'
