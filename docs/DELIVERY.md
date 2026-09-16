# Relatório de entrega da infraestrutura

Implementação no repositório preparada; homologação Docker e infraestrutura externa ainda pendentes. Os resultados efetivamente executados estão em [VALIDATION.md](VALIDATION.md).

1. **Arquitetura:** HTTPS por terminador externo ou Caddy → Nginx/SPA → `/api`/Node → PostgreSQL privado. SQLite mantido em desenvolvimento/testes, sem alterações de regras financeiras.
2. **Arquivos criados:** inventário abaixo, abrangendo imagens, Compose, proxy, workflows, scripts, testes e documentação.
3. **Arquivos modificados:** inventário abaixo. Não houve edição das migrations SQL, locks, esquema SQLite ou componentes de negócio.
4. **Dockerfiles:** backend Node 24.15.0 slim com dependências de produção e usuário node; frontend multi-stage Vite → Nginx sem root. `.dockerignore` compartilhado na raiz, pois ambos usam a raiz como build context para acessar `shared`.
5. **Compose:** `postgres`, `migrate`, `backend`, `frontend`; `tls` opcional no overlay. Volumes persistentes, redes internas, healthchecks, restart e portas restritas.
6. **Variáveis:** `.env.example` raiz para Compose, exemplos do backend/frontend atualizados. DATABASE_URL, credenciais PostgreSQL, FRONTEND_ORIGIN, SSL/pool/timeouts, sessão/rate limit, SameSite, imagens/SHA e TLS. Lista completa em [DEPLOY.md](DEPLOY.md#configuração-e-secrets).
7. **Secrets:** senha/URL do PostgreSQL no host ou secret manager; GITHUB_TOKEN automático no registry; credenciais adicionais só conforme hospedagem. A aplicação usa sessão opaca, não JWT: não foram inventados JWT_SECRET/CSRF_SECRET. Não há credencial de produção versionada.
8. **Workflows:** `ci.yaml` e `release.yaml`.
9. **Migrations:** runner existente com transação, advisory lock e checksum; `npm run migrate`/`db:migrate`. Em produção startup apenas verifica schema, sem migrations automáticas. SQL existente preservado.
10. **CI:** npm ci/cache, lint e testes de ambos os pacotes, Vite build, PostgreSQL real efêmero e teste Compose. Qualquer falha impede publicação.
11. **CD:** main → CI reutilizável → imagens por SHA → GHCR → deploy opcional protegido. O servidor não foi inventado; etapa remota depende de `DEPLOY_ENABLED=true` e runner preparado.
12. **Deploy:** pull → banco saudável → migrations → troca de containers → readiness + health HTTPS. Lock evita concorrência; falha de migration impede troca da API. Pode haver breve interrupção na substituição dos containers.
13. **Rollback:** imagem anterior por SHA, com verificação de compatibilidade antes da troca, sem rebuild ou reversão automática do banco. Backend v1 não é compatível com schema v2 existente; exige correção adiante ou recuperação planejada.
14. **Backup:** pg_dump custom, cópia protegida fora do host e restauração transacional em instância vazia separada; comandos e cuidados em DEPLOY.md. Não executado com containers nesta máquina.
15. **Portas:** dev 5173/3000; containers frontend 8080, backend 3000, PostgreSQL 5432. Só 127.0.0.1:8080 é publicado na base; overlay TLS publica 80/443. API/banco não publicam portas.
16. **Domínio/HTTPS:** terminador externo, Cloudflare Full(strict), load balancer ou Caddy automático documentados. DNS, certificados públicos e firewall são externos. Compose local também usa HTTPS, com CA local confiada explicitamente.
17. **Desenvolvimento:** npm ci nos pacotes; backend `migrate`, `auth:create-master`, `dev`; frontend `dev`; testes/lint próprios. Passo a passo no README.
18. **Produção:** configurar env externo; publicar imagens; exportar IMAGE_TAG/endereços de imagens e variáveis do deploy; executar `bash scripts/deploy.sh`. Bootstrap de administrador é interativo. Passo a passo e alternativa Compose manual em DEPLOY.md.
19. **Testes:** 146 backend/SQLite, 130 PostgreSQL, 12 frontend, lints/build/instalações limpas/audits aprovados. API runtime com role sem superuser, migrations idempotentes, health/indisponibilidade/recuperação verificados. Docker não está instalado; builds e smoke Compose não foram executados.
20. **Configuração manual restante:** Docker Linux e execução do smoke/CI; domínio/DNS/TLS; servidor/disco/firewall; secrets; GHCR/permissões; branch protection/environment/runner; teste de restauração e validação pelo navegador no domínio real. Nenhuma publicação ou operação externa foi feita.

## Arquivos criados

- `.dockerignore`
- `.env.example`
- `.gitattributes`
- `.github/workflows/ci.yaml`
- `.github/workflows/release.yaml`
- `README.md`
- `backend/Dockerfile`
- `backend/tests/health.test.js`
- `frontend/Dockerfile`
- `frontend/nginx.conf.template`
- `compose.yaml`
- `compose.tls.yaml`
- `deploy/Caddyfile`
- `deploy/postgres-init.sh`
- `scripts/deploy.sh`
- `scripts/rollback.sh`
- `scripts/smoke-compose.sh`
- `scripts/smoke-http.mjs`
- `docs/INFRASTRUCTURE.md`
- `docs/DEPLOY.md`
- `docs/VALIDATION.md`
- `docs/DELIVERY.md`

## Arquivos modificados

- `.gitignore`
- `backend/.env.example`
- `backend/README.md`
- `backend/SECURITY.md`
- `backend/package.json`
- `backend/database/migrate.js`
- `backend/src/app.js`
- `backend/src/config/env.js`
- `backend/src/config/auth.js`
- `backend/src/infrastructure/persistence/postgres.js`
- `backend/src/server.js`
- `backend/tests/configuration.test.js`
- `backend/tests/postgres.test.js`
- `frontend/.env.example`
- `frontend/README.md`
- `frontend/vite.config.js`

As pastas `.validation` e `node_modules`/`dist` contêm somente artefatos locais ignorados pelo Git e excluídos das imagens. Os processos temporários de validação foram encerrados.
