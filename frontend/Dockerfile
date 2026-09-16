# syntax=docker/dockerfile:1
FROM node:24.15.0-bookworm-slim AS build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/index.html frontend/vite.config.js frontend/jsconfig.json ./
COPY frontend/src ./src
COPY shared /app/shared
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.5-alpine AS runtime
ENV API_UPSTREAM=backend:3000 TLS_PROXY_CIDR=172.31.0.1/32
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health/live || exit 1
STOPSIGNAL SIGQUIT
