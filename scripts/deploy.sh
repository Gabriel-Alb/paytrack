#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
: "${DEPLOY_ENV_FILE:?Absolute path to production env file is required}"
: "${IMAGE_TAG:?Set an immutable commit SHA tag}"
: "${HEALTHCHECK_URL:?Set the public HTTPS URL ending in /api/health}"
: "${DEPLOY_STATE_DIR:?Set a persistent private directory outside the checkout}"
[[ "$IMAGE_TAG" =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected full commit SHA.' >&2; exit 1; }
[[ "$HEALTHCHECK_URL" == https://*/api/health ]] || { echo 'HTTPS health URL required.' >&2; exit 1; }
umask 077
mkdir -p "$DEPLOY_STATE_DIR"
exec 9>"$DEPLOY_STATE_DIR/deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
compose=(docker compose --env-file "$DEPLOY_ENV_FILE" -f compose.yaml)
if [[ "${DEPLOY_TLS:-external}" == caddy ]]; then compose+=(-f compose.tls.yaml); fi
"${compose[@]}" config --quiet
# Pull before touching running services. Never rebuild or silently use latest.
"${compose[@]}" pull backend frontend migrate
"${compose[@]}" up -d --wait postgres
"${compose[@]}" run --rm --no-deps migrate
# Migration failure exits above, leaving the current API untouched.
services=(backend frontend)
if [[ "${DEPLOY_TLS:-external}" == caddy ]]; then services+=(tls); fi
"${compose[@]}" up -d --no-deps --no-build --wait --wait-timeout 120 "${services[@]}"
curl --fail --silent --show-error --retry 12 --retry-all-errors --retry-delay 5 \
  --connect-timeout 5 --max-time 10 "$HEALTHCHECK_URL" > /dev/null
if [[ -f "$DEPLOY_STATE_DIR/current-sha" && "$(<"$DEPLOY_STATE_DIR/current-sha")" != "$IMAGE_TAG" ]]; then
  cp "$DEPLOY_STATE_DIR/current-sha" "$DEPLOY_STATE_DIR/previous-sha"
fi
printf '%s\n' "$IMAGE_TAG" > "$DEPLOY_STATE_DIR/current-sha"
echo "Deployment healthy: $IMAGE_TAG"
