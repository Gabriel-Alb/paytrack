#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
: "${DEPLOY_ENV_FILE:?Required}"
: "${DEPLOY_STATE_DIR:?Required}"
: "${IMAGE_TAG:?Set a previously published compatible full commit SHA}"
: "${HEALTHCHECK_URL:?Required}"
[[ "$IMAGE_TAG" =~ ^[a-f0-9]{40}$ && "$HEALTHCHECK_URL" == https://*/api/health ]] || exit 1
umask 077
mkdir -p "$DEPLOY_STATE_DIR"
exec 9>"$DEPLOY_STATE_DIR/deploy.lock"
flock -n 9
compose=(docker compose --env-file "$DEPLOY_ENV_FILE" -f compose.yaml)
if [[ "${DEPLOY_TLS:-external}" == caddy ]]; then compose+=(-f compose.tls.yaml); fi
"${compose[@]}" pull backend frontend
# Verify compatibility using the OLD image before replacing anything. No migration.
"${compose[@]}" run --rm --no-deps backend node database/check.js
"${compose[@]}" up -d --no-deps --no-build --wait --wait-timeout 120 backend frontend
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 \
  --connect-timeout 5 --max-time 10 "$HEALTHCHECK_URL" > /dev/null
printf '%s\n' "$IMAGE_TAG" > "$DEPLOY_STATE_DIR/current-sha"
echo "Rollback healthy: $IMAGE_TAG"
