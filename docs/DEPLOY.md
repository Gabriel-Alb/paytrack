# Operação e deploy

## Pré-requisitos e ambientes

Use Node 24.15.0, npm e os locks versionados. Docker Engine com Compose v2 recente (mínimo 2.24.4), Git, Bash, curl e flock no host Linux de deploy. Docker Desktop com containers Linux serve para testes locais. As imagens publicadas pelo workflow são linux/amd64; para servidor ARM configure o build multi-arquitetura antes da publicação.

Desenvolvimento: SQLite, `NODE_ENV=development`, `.env` do backend e Vite em 5173. Testes: `NODE_ENV=test`, SQLite isolado ou PostgreSQL exclusivo de testes. Produção: PostgreSQL, variáveis injetadas, cookies Secure e origem HTTPS obrigatória. O Compose sempre usa produção; não remova HTTPS para testar.

## Desenvolvimento e testes

Execute os comandos do [README](../README.md). Porta da API: 3000; Vite: 5173. SQLite fica em `backend/database/paytrack.db`; nunca é copiado para as imagens.

```sh
cd backend
npm ci
npm run lint
npm test
# Somente em um banco de testes: a suíte cria e remove schemas isolados.
TEST_DATABASE_URL='postgresql://usuario:senha-url-encoded@127.0.0.1:5432/banco_test' npm run test:postgres
cd ../frontend
npm ci
npm run lint
npm test
VITE_API_URL=/api npm run build
```

No PowerShell, defina variáveis por `$env:NOME='valor'` antes do comando. Não aponte TEST_DATABASE_URL para produção. O importador SQLite original continua disponível; exige dependências de desenvolvimento em uma estação de migração, não no container de runtime. Consulte `backend/README.md` para transferência offline e validação de uma cópia do SQLite.

## Configuração e secrets

Copie o `.env.example` da raiz para `.env`. Para produção prefira `/opt/paytrack/production.env` fora do checkout, com permissão 0600 e proprietário do deploy. Compose lê esse arquivo e injeta somente as variáveis declaradas. O Node não carrega `.env` em produção. Nunca publique a saída de `docker compose config` com valores; use `config --quiet` para validar.

| Variável | Uso |
| --- | --- |
| POSTGRES_DB, POSTGRES_USER | Nome do banco e usuário proprietário, sem valor secreto padrão |
| POSTGRES_PASSWORD | Obrigatória; gerar com `openssl rand -hex 32` ou gerenciador de secrets |
| DATABASE_URL | Obrigatória: `postgresql://USUARIO:SENHA@postgres:5432/BANCO`; deve corresponder aos valores acima; caracteres especiais precisam percent-encoding |
| DATABASE_SSL | `disable` somente para o PostgreSQL na rede interna deste Compose; `verify-full` para banco remoto com TLS |
| DATABASE_SSL_CA | Backend direto: caminho PEM montado somente leitura para CA privada; se usar Compose com banco remoto, adicionar variável e volume por override local |
| DATABASE_POOL_MAX | 5 no Compose; limite global deve considerar API, migration e administração |
| DATABASE_CONNECT_TIMEOUT_MS / DATABASE_IDLE_TIMEOUT_MS / DATABASE_STATEMENT_TIMEOUT_MS | 5000 / 30000 / 30000 no Compose |
| FRONTEND_ORIGIN | Origem pública exata, por exemplo `https://financeiro.exemplo.com`, sem barra/caminho |
| COOKIE_SAME_SITE | `strict` padrão; `none` somente se frontend/API estão em sites diferentes, mantendo HTTPS e CSRF |
| VITE_API_URL | Obrigatória no build; `/api` somente com proxy no mesmo domínio, URL absoluta terminada em `/api` se separado; valor público incorporado no build |
| BACKEND_IMAGE / FRONTEND_IMAGE | Caminhos GHCR ou nomes locais |
| IMAGE_TAG | `local` para desenvolvimento Docker; SHA completo publicado para deploy |
| HTTP_PORT | 8080; publicado exclusivamente em 127.0.0.1 |
| TLS_PROXY_CIDR | IP/CIDR do terminador TLS visto pelo Nginx; padrão gateway 172.31.0.1/32, substituído por 172.31.0.3/32 no overlay Caddy |
| SITE_ADDRESS / TLS_BIND_IP | Hostname sem protocolo para Caddy; em produção bind `0.0.0.0`, local `127.0.0.1` |
| HTTPS_PORT / HTTPS_REDIRECT_PORT | Portas públicas 443/80 com Caddy |
| SESSION_MAX_AGE / SESSION_IDLE_AGE | 86400/7200 segundos; revogação e expiração existentes preservadas |
| AUTH_WINDOW_MS / AUTH_LOGIN_IP_LIMIT / AUTH_LOGIN_ACCOUNT_LIMIT / AUTH_REQUEST_IP_LIMIT | 900000 / 30 / 10 / 5; limites persistidos |
| TIME_ZONE / ATTENTION_DAYS | America/Sao_Paulo / 2; regras existentes |

O Compose fixa `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`, `DATABASE_CLIENT=postgres`, `TRUST_PROXY=loopback,172.30.0.2/32`. Ao executar a imagem fora do Compose, configure o IP/CIDR real do proxy e nunca use confiança global ou quantidade de saltos sem controlar o caminho.

Não existem JWT_SECRET, JWT_EXPIRES_IN, SESSION_SECRET nem CSRF_SECRET nesta implementação. Sessão e CSRF são gerados pelo sistema e persistidos no banco; não transforme esses dados em variáveis. Secrets necessários: senha/URL do banco e, conforme hospedagem, credenciais do registry/deploy. GitHub usa o GITHUB_TOKEN automático com escopo mínimo para GHCR. Nenhuma chave SSH é exigida pelo fluxo opcional com runner no servidor.

## Docker local com HTTPS

Com `.env` preenchido, mantenha `SITE_ADDRESS=localhost`, `FRONTEND_ORIGIN=https://localhost`, `TLS_BIND_IP=127.0.0.1`:

```sh
docker compose -f compose.yaml -f compose.tls.yaml config --quiet
docker compose -f compose.yaml -f compose.tls.yaml build backend frontend
docker compose -f compose.yaml -f compose.tls.yaml up -d --wait --wait-timeout 180
docker compose exec backend npm run auth:create-master
docker compose -f compose.yaml -f compose.tls.yaml cp tls:/data/caddy/pki/authorities/local/root.crt ./localhost-root.crt
curl --cacert ./localhost-root.crt https://localhost/api/health
```

Caddy cria uma CA local para localhost. Importe **apenas esse certificado público** no trust store de desenvolvimento para o navegador, ou use `curl --cacert` para testes. Não desative validação TLS em produção. Nunca copie a chave privada da CA. Abra `https://localhost`; não use 8080 diretamente: essa porta exige o proxy TLS confiável.

`bash scripts/smoke-compose.sh` cria um projeto descartável `paytrack-smoke`, gera credenciais efêmeras, testa HTTPS com a CA local, API, login/CSRF, rotas reais e portuguesas, cache, non-root, portas privadas, indisponibilidade, reinícios e persistência após `down`. Ao encerrar, remove **somente seus volumes de teste**. Execute em host dedicado de CI/testes, sem outra stack usando as mesmas sub-redes.

## Produção: banco, migrations e primeira implantação

1. Provisionar um host Linux pequeno, disco persistente e destino independente para backups. Dimensionar após medir; API única e pool de 5 são o ponto inicial. Restringir SSH e Docker a administradores.
2. Configurar env externo com credenciais próprias. O usuário definido em POSTGRES_USER recebe propriedade do banco; o script de primeira inicialização retira SUPERUSER/CREATEDB/CREATEROLE/REPLICATION. Ele mantém DDL no banco da aplicação para migrations. Em volume preexistente, validar privilégios com o DBA: scripts de init não são reaplicados. Alterar POSTGRES_PASSWORD no env não altera senha de um volume existente; rotacione a role no banco e atualize o secret em conjunto.
3. Preparar domínio e TLS conforme seção seguinte. PostgreSQL não publica porta; Node também não. Redes `database` e `application` são internas. As sub-redes 172.30.0.0/24 e 172.31.0.0/24 devem estar livres; se alteradas, atualizar IPs e listas de proxies coordenadamente.
4. Fazer backup antes de upgrade de schema. Em primeira implantação vazia não há dados para copiar.
5. Publicar imagens pelo workflow ou construir localmente com `docker compose --env-file /opt/paytrack/production.env build backend frontend`.
6. Iniciar o banco, aplicar migrations e iniciar a API, nesta ordem:

```sh
docker compose --env-file /opt/paytrack/production.env up -d --wait postgres
docker compose --env-file /opt/paytrack/production.env run --rm --no-deps migrate
docker compose --env-file /opt/paytrack/production.env up -d --no-deps --wait backend frontend
docker compose --env-file /opt/paytrack/production.env exec backend npm run auth:create-master
```

O comando interativo cria o primeiro administrador, sem senha padrão, e recusa novo bootstrap quando já existe um. O container não contém seed. Nunca inicialize produção com dados demonstrativos.

Migrations reutilizam integralmente o runner existente: transação única, advisory lock entre migradores, histórico e checksum. `npm run migrate` e `npm run db:migrate` são equivalentes. Falha sai com código diferente de zero e reverte a transação. Em produção, startup, check e bootstrap de administrador apenas verificam o schema. Sem migrations ou com checksum/versão divergente, a API não inicia. Não existe reset automático nem DROP DATABASE/TABLE novo.

## Domínio, HTTPS e proxies

Opção externa: publique TLS em um Nginx/Caddy/load balancer do host, encaminhando para `127.0.0.1:8080`. Redirecione 80→443 no terminador. O proxy deve **sobrescrever** `X-Forwarded-Proto` com o protocolo verificado e `X-Forwarded-For` com o IP validado, jamais repassar valores arbitrários do cliente. Preserve Host, Origin e cookies. Para SSE, desligue buffering e mantenha timeout acima de 15s. Configure TLS_PROXY_CIDR com o endereço do proxy observado no bridge; se estiver errado, Nginx rejeita HTTP/headers não confiáveis com 426.

Exemplo de bloco no terminador Nginx do host, após configurar certificado e chave **fora do Git**:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_buffering off;
    proxy_read_timeout 75s;
}
```

Opção automática: configure `SITE_ADDRESS=financeiro.exemplo.com`, `FRONTEND_ORIGIN=https://financeiro.exemplo.com`, `TLS_BIND_IP=0.0.0.0`, DNS apontando para o host e portas 80/443 liberadas. Use `-f compose.yaml -f compose.tls.yaml` e inicie `tls` após frontend/backend. Caddy provisiona/renova certificados e redireciona HTTP. Volumes `caddy_data` e `caddy_config` precisam persistir. Administração Caddy fica desativada; serviço roda sem root. Se já existe terminador externo nas mesmas portas, escolha apenas uma dessas opções.

Cloudflare: use Full (strict) com certificado válido na origem e bloqueie acesso direto conforme sua topologia. Nunca use Flexible. Para preservar IP real atrás da Cloudflare, o terminador precisa confiar **somente nas faixas oficiais atuais** do provedor e normalizar o header antes de enviá-lo ao Nginx; não confie em CF-Connecting-IP de conexões arbitrárias. Essas faixas, DNS, firewall e certificados pertencem à infraestrutura externa e não foram inventados aqui.

Domínios separados: build frontend com `VITE_API_URL=https://api.exemplo.com/api`, configure FRONTEND_ORIGIN na API com a origem exata da SPA e encaminhe o domínio da API pelo mesmo proxy controlado. Subdomínios HTTPS do mesmo site podem manter Strict. Sites diferentes exigem `COOKIE_SAME_SITE=none`; Secure/HttpOnly, validação de origem, CSRF e credentials permanecem ativos. Navegadores que bloqueiam cookies de terceiros podem impedir esse cenário; prefira `/api` no mesmo domínio para confiabilidade. Nenhum segredo pode ir para VITE_*.

No Render com frontend/API separados, configure `VITE_API_URL=https://paytrack-backend-9amo.onrender.com/api` no ambiente de **build do serviço frontend** e execute um novo build/deploy. Definir a variável apenas no backend ou no runtime de uma imagem já construída não modifica o JavaScript publicado. Se usar arquivos, o Vite lê `frontend/.env` e `frontend/.env.production`; o `.env` da raiz é usado pelo Compose e não é carregado automaticamente pelo Vite. Variáveis do processo de build têm precedência sobre esses arquivos. Em Docker, passe a variável como build argument (o Compose e o workflow de release já fazem isso). O proxy de desenvolvimento não existe no site estático do Render; não use `/api` nesse cenário. Sem valor explícito, o build falha para evitar publicar novamente o fallback local.

## CI, registry e CD

`ci.yaml` roda em PRs, pushes fora de main e como workflow reutilizável. Jobs: backend lint/test, frontend lint/test/build, PostgreSQL real efêmero e smoke de todos os containers. Usa npm ci/cache; qualquer falha bloqueia o workflow. PostgreSQL de teste usa senha aleatória; não depende de secrets de produção nem do servidor.

`release.yaml` roda no push/merge em main ou disparo manual em main: chama CI, constrói as duas imagens, publica `ghcr.io/<owner-em-minúsculas>/paytrack-{backend,frontend}:<SHA-completo>`. Não depende de latest. Não apague tags que ainda sejam candidatas a rollback. Configure branch protection exigindo jobs de CI antes do merge.

Sem servidor definido, publicação funciona e deploy remoto fica desativado. Para ativar:

- Criar environment `production`, restringir à main e configurar proteções apropriadas.
- Instalar um runner Linux dedicado no servidor, com label `paytrack-production`, Docker/Compose, Bash/curl/flock e acesso somente aos workflows confiáveis de produção. Nunca usar esse runner para executar PRs de origem não confiável.
- Configurar variables do repositório: `DEPLOY_ENABLED=true`, `DEPLOY_ENV_FILE=/opt/paytrack/production.env`, `DEPLOY_STATE_DIR=/opt/paytrack/state`, `HEALTHCHECK_URL=https://financeiro.exemplo.com/api/health`, `DEPLOY_TLS=external` ou `caddy`. DEPLOY_ENABLED precisa estar no escopo do repositório para o job ser agendado.
- Opcional: `VITE_API_URL` nos repository variables se API separada; default `/api`.
- Autorizar GitHub Actions a publicar/ler os pacotes GHCR; para publicação existente, associar pacotes ao repositório. O token automático é usado apenas para login, com logout pelo action.
- Proteger env e diretório de estado no host. Somente o serviço de deploy deve poder escrevê-los.

O script usa flock e o workflow serializa releases sem cancelar migrations em andamento. Faz pull das imagens, verifica banco, executa migration e só depois substitui backend/frontend. Aguarda readiness do Docker e health público HTTPS. Falha de migration deixa a API anterior intacta; falha posterior não é anunciada como sucesso e exige rollback/diagnóstico. Esta estratégia pode ter alguns segundos de interrupção durante a troca de containers; não promete zero downtime.

Deploy manual das imagens publicadas (mesmo caminho usado no CD):

```sh
export BACKEND_IMAGE=ghcr.io/gabriel-alb/paytrack-backend
export FRONTEND_IMAGE=ghcr.io/gabriel-alb/paytrack-frontend
export IMAGE_TAG=<SHA-completo-publicado>
export DEPLOY_ENV_FILE=/opt/paytrack/production.env
export DEPLOY_STATE_DIR=/opt/paytrack/state
export HEALTHCHECK_URL=https://financeiro.exemplo.com/api/health
export DEPLOY_TLS=caddy # ou external
bash scripts/deploy.sh
```

Antes, autentique o host no GHCR com token de leitura via `docker login --password-stdin` se imagens privadas. Não grave tokens em comandos versionados. A variável exportada IMAGE_TAG tem precedência sobre o arquivo env. Use o checkout correspondente à versão publicada para ter configurações compatíveis.

## Health, logs e persistência

API: `/health/live` verifica processo; `/health/ready` executa SELECT 1 e devolve 503 quando banco indisponível ou servidor encerrando. São probes internos sem dados sensíveis; Nginx não publica readiness. `/api/health` preserva endpoint existente e exige HTTPS. Docker verifica readiness Node e liveness Nginx; o deploy verifica também a URL HTTPS externa.

```sh
docker compose --env-file /opt/paytrack/production.env ps
docker compose --env-file /opt/paytrack/production.env logs --tail=100 backend frontend postgres
curl --fail https://financeiro.exemplo.com/api/health
```

Logs vão para stdout/stderr, com rotação Docker (3 arquivos de 10 MB por serviço). Nginx não registra URL, query, cookie ou payload; backend registra mensagens genéricas em erros. Auditoria de negócio continua no banco. SIGTERM drena conexões, interrompe manutenção e fecha pool, limitado a 25 segundos; Compose concede 30 segundos.

`docker compose down` preserva os volumes nomeados. **`docker compose down -v` apaga os volumes e seus dados**, inclusive certificados locais se aplicado ao overlay. Não use em produção sem intenção explícita de exclusão e backup verificado. Healthcheck unhealthy não reinicia sozinho um processo travado: monitor externo deve alertar; restart policy cobre saída do processo/reboot.

## Backup e restauração

Faça backup diário e antes de migrations, com retenção definida pelo negócio. Copie criptografado para outro disco/host e teste restauração periodicamente. Proteja backups como dados pessoais e credenciais: contêm documentos, hashes e sessões. Snapshot/volume persistente não substitui cópia independente.

Em Bash no host, o dump abaixo usa arquivo dentro de /tmp do container e `docker cp`, evitando corrupção binária por redirecionamento no Windows:

```sh
umask 077
mkdir -p backups
backup="backups/paytrack-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file /opt/paytrack/production.env exec -T postgres sh -eu -c \
  'umask 077; pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-acl --file=/tmp/paytrack-backup.dump'
docker compose --env-file /opt/paytrack/production.env cp postgres:/tmp/paytrack-backup.dump "$backup"
docker compose --env-file /opt/paytrack/production.env exec -T postgres rm /tmp/paytrack-backup.dump
sha256sum "$backup" > "$backup.sha256"
```

Não execute backups simultâneos com esse nome temporário fixo. `pg_dump` obtém snapshot consistente sem parar operações. Mantenha também inventário de versões/configuração e secrets em cofre separado. Faça upgrades maiores do PostgreSQL por migração/dump e restore planejados; trocar tag de major mantendo o mesmo volume não é upgrade válido.

Restaure primeiro em **outra instância PostgreSQL vazia**, criada para recuperação, com volume próprio e credenciais próprias, sem iniciar migrate/backend. Nunca restaure sobre o único banco de produção. Os comandos abaixo pressupõem que o projeto `paytrack-restore` já foi provisionado nesse ambiente independente (outra máquina/rede para não conflitar com IPs fixos):

```sh
docker compose --env-file /opt/paytrack/restore.env -p paytrack-restore up -d --wait postgres
docker compose --env-file /opt/paytrack/restore.env -p paytrack-restore exec -T postgres sh -eu -c \
  'pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --no-acl --exit-on-error --single-transaction' < backups/SEU-BACKUP.dump
```

Execute a restauração acima em Bash: o redirecionamento binário do arquivo para stdin não deve ser substituído por um pipeline de texto do PowerShell. Não use `--clean`/DROP no banco ativo. Valide `db:check`, usuários, empresas, clientes, contratos, pagamentos, saldos e login com a imagem compatível com o backup. Somente depois planeje a troca da aplicação para o banco restaurado. A role do Compose não tem CREATEDB: um banco adicional no mesmo cluster exige operação explícita de DBA; o procedimento acima usa outro cluster vazio.

## Atualização e rollback

Backup → release CI/publicação → `scripts/deploy.sh`. O diretório de estado registra current-sha e previous-sha somente após saúde confirmada. Registre também manualmente a versão do schema, imagem e backup antes de uma alteração.

Para reverter **somente código** com schema compatível, exporte o SHA anterior mantendo demais variáveis do deploy e execute:

```sh
export IMAGE_TAG=<SHA-anterior-publicado>
bash scripts/rollback.sh
```

O script faz pull da versão anterior, executa `db:check` com ela antes de substituir containers, reinicia sem executar migrations, aguarda saúde interna e HTTPS. Não reconstrói imagens e não apaga dados. Não há rollback automático de schema.

O verificador atual exige versão/checksum exatos. Portanto rollback entre imagens só funciona se ambas suportarem o mesmo schema. A migration PostgreSQL v2 preexistente remove a coluna antiga de cliente; backend v1 não funciona sobre v2. Nesse caso prefira correção adiante, ou restauração planejada para outro banco e corte coordenado, considerando todas as escritas posteriores ao backup. Novas migrations devem adotar expansão/transição/contração em releases separados e testar a compatibilidade da imagem anterior antes de prometer rollback.

## Itens externos e validação pendente

Domínio, DNS, host, firewall, TLS público, secrets reais, runner e políticas GitHub/GHCR precisam ser configurados pelo responsável pela hospedagem. Não houve publicação, alteração de DNS nem deploy em servidor externo nesta preparação. Consulte [VALIDATION.md](VALIDATION.md) para resultados realmente executados e verificações pendentes; disponibilizar workflows não equivale a executá-los no GitHub.
