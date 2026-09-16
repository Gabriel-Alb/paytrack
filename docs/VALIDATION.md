# Validação da infraestrutura — 16/09/2026

## Executado nesta máquina

Ambiente: Windows, Node 24.15.0. PostgreSQL 18 instalado fora do PATH; foi criado um cluster temporário em `.validation/postgres`, escutando apenas em `127.0.0.1:55439`. A instância PostgreSQL preexistente e bancos locais do usuário não foram utilizados. O CI/Compose usam PostgreSQL 17; a validação local foi feita na versão 18 disponível.

| Verificação | Resultado |
| --- | --- |
| Instalação limpa backend (`npm ci`) | Passou, 235 pacotes |
| Instalação limpa frontend (`npm ci`) | Passou, 262 pacotes |
| Instalação isolada runtime (`npm ci --omit=dev`) | Passou, 101 pacotes, sem better-sqlite3 |
| ESLint backend | Passou |
| Testes backend/SQLite (`npm test`) | 146 testes, zero falhas na execução final |
| Testes PostgreSQL (`npm run test:postgres`) | 130 testes, zero falhas; inclui produção, preservação de dados, checksum, reversão transacional, importação e concorrência |
| Novos testes de config/health | Passaram; incluídos na suíte final |
| ESLint frontend | Passou |
| Testes frontend | 12 testes, zero falhas |
| Vite build produção | Passou; bundles gerados, DevTools restrito ao desenvolvimento |
| npm audit backend/frontend | Zero vulnerabilidades reportadas na consulta; também verificado backend omitindo dev |
| Migrate CLI com role sem superuser | Aplicou schema v2 em banco vazio e reaplicou idempotentemente |
| Check CLI | PostgreSQL v2, 11 tabelas |
| API com apenas dependências de produção | Iniciou em porta temporária 33019 usando PostgreSQL e role sem privilégios de administração de cluster |
| Health interno | Liveness/readiness 200; API HTTP recusada com 400; protocolo HTTPS do proxy confiável aceito |
| Indisponibilidade real do PostgreSQL | Readiness 503 e liveness 200, sem detalhes internos |
| Reconexão | Readiness voltou a 200 após religar PostgreSQL, sem reiniciar a API |
| YAML Compose/workflows | Parse dos quatro arquivos passou |
| Scripts Bash/JS | Verificação sintática passou |
| Integridade do diff | `git diff --check` sem erros |

A instalação inicial via sandbox encontrou bloqueio de cache npm; a execução autorizada fora do sandbox concluiu. O PostgreSQL temporário também precisou dessa execução para criar/iniciar o cluster no Windows. Nenhuma dependência foi atualizada ou substituída; manifests/locks originais foram reaproveitados.

## Bloqueado / não executado

**Docker Engine/CLI e WSL não estão instalados nesta máquina.** Portanto não foi possível executar build das imagens, `docker compose config` pelo próprio Compose, startup do Nginx/Caddy/PostgreSQL em containers, smoke HTTPS/SPA/login no Compose, validação do volume Docker ou reinícios de containers. O parse YAML e os testes nativos não substituem essas verificações.

O job `containers` em `ci.yaml` executará `scripts/smoke-compose.sh` em Ubuntu com Docker antes da publicação. Ele valida os dois builds, migrations, TLS local com certificado verificado, acesso às rotas, cache, login, CSRF/origem, cookies Secure/HttpOnly, rate limit atrás de proxy, non-root, ausência de portas públicas da API/banco, indisponibilidade e persistência depois de `down`. **O script foi preparado e revisado, mas ainda não executado.**

Não foi executada validação visual em navegador, nem certificados/DNS públicos, login no GHCR, publicação de imagens ou workflows no GitHub, deploy/rollback em host real. Backup/restore estão documentados, mas o procedimento com containers também depende de Docker. Testes locais não validam navegadores que bloqueiam cookies de terceiros.

## Antes de liberar produção

1. Instalar/usar Docker com containers Linux e executar o CI/smoke completo; corrigir qualquer falha antes de publicar.
2. Configurar domínio, TLS, firewall, env/secrets, registry e servidor/runner conforme DEPLOY.md.
3. Testar restauração de uma cópia de backup e conferir clientes, empresas, contratos e saldos.
4. Validar login, refresh de rotas e SSE pelo domínio HTTPS real nos navegadores utilizados.
5. Habilitar deploy automático somente após o ambiente e os checks estarem saudáveis.

O repositório contém a implementação de infraestrutura e o caminho de validação; **a homologação Docker e o deploy externo permanecem pendentes**, e não devem ser tratados como concluídos.
