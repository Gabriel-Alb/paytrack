# Análise do repositório e decisões

Inspeção anterior às alterações: raiz Git na pasta interna `paytrack`, remoto GitHub `Gabriel-Alb/paytrack`, sem alterações locais detectadas. Não existiam Dockerfiles, Compose ou workflows. Foram inspecionados manifests/locks, configuração, entrypoints, drivers, migrations, scripts, testes, autenticação, roteamento, comunicação HTTP e documentação.

| Área | Implementação encontrada / aproveitamento |
| --- | --- |
| Frontend | Vue, Vite, Tailwind, Pinia, Vue Router com history; `npm run build` gera `dist`; `npm run dev` em 5173; testes Node e ESLint existentes |
| Node | Backend exige >=22.18 e frontend ^22.18 ou >=24.12; imagens e CI usam Node 24.15.0, compatível com os locks |
| Backend | `node src/server.js`, porta 3000, host local por padrão; imagem usa `HOST=0.0.0.0`; routes/controllers/services/repositories preservados |
| Ambiente | dotenv somente no desenvolvimento, caminho ancorado no backend; Zod valida ambiente, origem HTTPS, timeouts, driver e TLS |
| API | `/api`, frontend usa `VITE_API_URL` ou `/api`; fetch e EventSource já incluem cookies; CSRF em header |
| Autenticação | Sessões opacas aleatórias persistidas por hash, Argon2id, expiração/revogação e auditoria. Não utiliza JWT, JWT_SECRET ou CSRF_SECRET. Implementação mantida |
| Banco | PostgreSQL obrigatório em produção; SQLite/better-sqlite3 em dev/test; `pg` com pool, timeout e SSL verificado. Sem fallback para SQLite em produção |
| Migrations | PostgreSQL v2: transação, advisory lock, SHA-256, histórico; SQLite v6 e importação offline existentes preservados |
| Runtime | `argon2`, `cors`, `dotenv`, `express`, `express-rate-limit`, `helmet`, `pg`, `zod`; SQLite e ferramentas de teste ficam nas devDependencies |
| Segurança | Origem exata, CSRF, cookies HttpOnly/Secure, rate limit persistido, headers Helmet, erros sem dados internos |
| PWA | Não foram encontrados manifest, registro de service worker ou plugin PWA. Não foi inventada uma PWA; cache do Nginx prevê revalidação desses arquivos caso sejam adicionados |
| Rotas | Rotas reais são `/clients`, `/loans`, `/reports`, `/users`. URLs em português recebem a SPA e seguem o redirecionamento já existente no Vue Router |

Mudanças de aplicação limitadas à infraestrutura: startup PostgreSQL em produção passa a verificar migrations sem executá-las; `npm run migrate` aplica explicitamente as existentes; healthchecks separados; trust proxy aceita IP/CIDR explícito; SameSite configurável com Strict como padrão e None restrito a produção; shutdown com prazo máximo; DevTools somente no servidor de desenvolvimento.

As migrations SQL existentes não foram editadas. A migration v2 já transfere a empresa para o empréstimo, remove a antiga coluna de cliente e recria views/triggers. Ela preserva os registros, mas não é compatível com backend v1. Não se deve executar rollback para v1 contra um banco v2.

Arquitetura: TLS → Nginx/SPA → `/api`/Node → PostgreSQL privado. Um serviço temporário `migrate` usa a mesma imagem da API. Caddy é opcional para TLS automático. Uma única instância de API/pool de 5 conexões atende ao porte informado; não foram incluídos Kubernetes, serviços pagos ou outra stack.

Referências oficiais usadas para configuração: [ordem de startup Compose](https://docs.docker.com/compose/how-tos/startup-order/), [Express atrás de proxies](https://expressjs.com/en/guide/behind-proxies/), [publicação Docker em Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [Caddy Docker](https://github.com/caddyserver/caddy-docker), [Nginx sem root](https://github.com/nginx/docker-nginx-unprivileged).
