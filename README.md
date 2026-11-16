# PayTrack

Vue 3/Vite + Node.js + PostgreSQL em produção, SQLite em desenvolvimento e testes.

Consulte [o guia de operação e deploy](docs/DEPLOY.md), [a análise inicial](docs/INFRASTRUCTURE.md), [a API](backend/README.md) e [a política de segurança](backend/SECURITY.md).

```sh
# Terminal 1
cd backend
npm ci
cp .env.example .env
npm run migrate
npm run auth:create-master
npm run dev
```

```sh
# Terminal 2, a partir da raiz do repositório
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Abra http://localhost:5173. Em PowerShell, use `Copy-Item` no lugar de `cp` se preferir.
O administrador é criado interativamente, sem credenciais padrão. O seed é opcional e exclusivo de desenvolvimento.

Testes: `npm test` e `npm run lint` em cada pacote; `npm run build` no frontend.
Produção: copie `.env.example` da raiz, configure as credenciais, domínio e TLS conforme [DEPLOY.md](docs/DEPLOY.md).

## Bloqueio temporário de acesso

O bloqueio vem ativo por padrão. O operador controla a suspensão pela variável
`SERVICE_LOCK_ENABLED` do backend. Use `true` para suspender o acesso ou
`false` para restabelecê-lo. A configuração persiste até a próxima alteração manual.

Em desenvolvimento, edite `backend/.env` e reinicie a API. No Compose, edite o
`.env` da raiz e execute `docker compose up -d --no-deps backend` para recriar
o serviço com a nova configuração. Em outras hospedagens, atualize a variável
de ambiente e reaplique a configuração em todas as instâncias da API.
Sessões ainda válidas retomam o acesso com suas permissões habituais.
