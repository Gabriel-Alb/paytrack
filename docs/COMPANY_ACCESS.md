# Acesso e administração por empresa

## Continuação da implementação

Ao retomar, já existiam o campo de nível em `user_companies`, a tabela de decisões
por empresa, autorização empresarial, proteção do último gerente, auditoria e uso
das transações existentes. As migrations e os componentes de administração estavam
escritos, mas ainda sem regressões completas e com integração parcial da interface.
As alterações visuais preexistentes nos demais componentes foram preservadas.

A continuação completou seleção de empresas no cadastro, estados de carregamento e
repetição de falhas, decisões independentes, listagem de acessos, accordion com
paginação, promoção/rebaixamento e remoção. Atualizações revalidam a sessão e o
escopo; perda de gerência encerra a administração ou fecha a revisão de escopo
antigo. Corrigiu também a emissão de eventos antes do commit na aprovação legada.

## Regras

- `users.role`: `admin` é o administrador global; `user` recebe permissões por vínculo.
- `user_companies.role`: `USER` usa os dados financeiros das empresas vinculadas;
  `MANAGER` também administra solicitações e membros somente daquela empresa.
- Ter `MANAGER` na empresa A e `USER` na B não autoriza administrar B. Nenhum papel
  empresarial amplia o escopo financeiro para empresas sem vínculo.
- Gerentes veem apenas empresas administradas, membros e solicitações desse escopo.
  CPF, RG e CNH de outros usuários aparecem apenas para administradores globais.
- Gerentes alteram níveis e removem membros existentes, mas não vinculam IDs globais
  arbitrários nem alteram papel global, bloqueio global ou cadastro de empresas.
- Administradores globais podem criar/renomear empresas, vincular usuários ativos
  ou bloqueados e recuperar empresas sem gerente. O editor global mantém o nível
  dos vínculos preservados e cria novos vínculos como `USER`.
- Um gerente não pode remover ou rebaixar o próprio último vínculo de gerente ativo
  da empresa. Outro gerente bloqueado não conta como substituto. A exceção é o
  administrador global, que pode recuperar/corrigir a configuração da empresa.
- Decisões são independentes: aprovar A não decide B. A primeira aprovação ativa a
  conta e concede apenas o vínculo aprovado. Sem aprovação, pendências mantêm a conta
  pendente; todas recusadas tornam a conta rejeitada. Aprovar outra empresa nunca
  desbloqueia uma conta bloqueada globalmente.
- Repetir a mesma decisão é idempotente. Decisão conflitante retorna `409` e não
  recria vínculo removido. Lotes são inteiramente autorizados antes de qualquer
  escrita. Falhas de auditoria revertem o lote, inclusive status e vínculos.
- Sessão, estado ativo, CSRF e origem continuam obrigatórios. O ator e seus níveis
  são relidos dentro da transação administrativa; o servidor não confia em IDs de
  empresas, papel ou responsável enviados pelo cliente. Transações serializadas
  protegem decisões concorrentes e o último gerente nos dois bancos.
- Clientes continuam globais conforme o modelo anterior; contratos, parcelas,
  pagamentos, multas, históricos, dashboard e relatórios respeitam os vínculos.

## Endpoints

Todos os caminhos usam o prefixo `/api`.

| Método e caminho | Autorização / comportamento |
| --- | --- |
| `GET /auth/companies` | Público com limitação; somente ID e nome das empresas |
| `POST /auth/request-access` | Público com CSRF, origem e limitação; `companyIds` aceita várias empresas, sem conceder vínculo |
| `GET /auth/me` | Usuário autenticado; inclui `companies[].role`, `companyIds` e `managedCompanyIds` |
| `GET /companies` | Empresas financeiramente acessíveis ao usuário |
| `GET /companies/managed` | Admin: todas; gerente: somente as gerenciadas |
| `GET /companies/:id/users?page=1` | Admin ou gerente da empresa; 50 registros por página e total filtrado |
| `PATCH /companies/:id/users/:userId` | Admin ou gerente da empresa; corpo `{ "role": "USER" }` ou `{ "role": "MANAGER" }` |
| `DELETE /companies/:id/users/:userId` | Remove somente esse vínculo; aplica proteção do último gerente |
| `GET /users?status=pending&page=1` | Admin ou gerente; filtros e totais por escopo. Pendências podem incluir contas já ativas em outra empresa |
| `GET /users/:id` | Revisão com vínculos e solicitações filtrados; sem documentos para gerente |
| `PATCH /users/:id/company-access` | Decisões empresariais independentes; somente empresas administradas e solicitadas |
| `GET /users/events` | Admin ou gerente; sessão e níveis revalidados; encerra ao perder autorização |
| `GET /notifications` | Solicitações pendentes filtradas por gerência e histórico financeiro pelo escopo existente |
| `PATCH /users/:id/access` | Somente admin: acesso global e compatibilidade com aprovação anterior |
| `POST /companies`, `PATCH /companies/:id` | Somente admin global |

Exemplo de decisão em lote:

```json
{
  "decisions": [
    { "companyId": 1, "action": "approve", "role": "MANAGER" },
    { "companyId": 2, "action": "reject" }
  ]
}
```

Empresas omitidas permanecem pendentes. IDs repetidos, empresas inexistentes,
campos extras ou níveis fora de `USER`/`MANAGER` são recusados. O formulário exige
ao menos uma empresa. A API preserva cadastros legados sem `companyIds`, visíveis
somente ao administrador global; uma lista explicitamente vazia é inválida.
Na rota legada `/access`, aprovar seleciona empresas pendentes e recusa as demais;
a nova interface usa `/company-access` para preservar decisões independentes.

## Migrations

- SQLite: versão **7**, `sqlite/company-roles-migration.js` e `SQL/schema.sql`.
  Acrescenta `role NOT NULL DEFAULT 'USER'` com CHECK e cria `user_access_companies`
  com PK composta, FKs, índices e constraints de decisão. Vínculos existentes
  permanecem `USER`; não cria gerentes nem altera dados financeiros.
- PostgreSQL: **003-company-roles.sql**, registrada no executor e na verificação de
  checksums. Aplica as mesmas regras, dentro da transação existente, com lock de
  migração. Não modifica as migrations 001/002 já aplicadas.
- Importação: aceita SQLite **v6 e v7** em modo somente leitura. v6 recebe `USER`
  por padrão; v7 preserva níveis, decisões e responsáveis. Nenhuma origem é
  migrada ou sobrescrita durante a transferência.
- Reabertura idempotente, rollback de DDL/dados/versão e nova tentativa após falha
  são cobertos em SQLite e PostgreSQL real. O importador também verifica rollback.

Execute `npm run db:migrate` e `npm run db:check` em `backend`, no ambiente alvo.
SQLite local também migra ao abrir. PostgreSQL em produção exige a migration
explícita antes da inicialização da aplicação. Nesta tarefa foram usados apenas
bancos de teste; o banco de uso real não foi migrado.

## Verificação

As regressões cobrem cadastro multiempresa, aprovação e recusa parcial, paginação,
minimização de dados, mass assignment, IDs fora do escopo, CSRF, sessão antiga,
auditoria/rollback, eventos após commit, SSE após revogação, decisões simultâneas,
último gerente, preservação de níveis e isolamento financeiro de gerentes.

O teste de navegador sobe sua própria API e banco descartável. Os sete cenários
verificam cadastro, escopo de gerente, decisões, accordion, persistência de níveis,
revogação/último gerente e saúde de renderização. Usa desktop 1440×1000 e mobile
390×844. O Browser plugin não estava disponível; foi usado Playwright com Chrome
local. Ferramentas Vue DevTools ficam desativadas no modo de teste.

Comandos: `npm test`, `npm run lint`, `npm run test:postgres` (backend);
`npm test`, `npm run lint`, `npm run build`, `npm run test:e2e` (frontend).
O CI inclui o novo teste de navegador após instalar backend e Chromium.

## Resultado local — 20/09/2026

| Verificação | Resultado |
| --- | --- |
| Backend SQLite (`npm test`) | 174 aprovados, zero falhas |
| Backend PostgreSQL 18 real (`npm run test:postgres`) | 158 aprovados, zero falhas |
| Frontend unitário (`npm test`) | 15 aprovados, zero falhas |
| Frontend E2E (`npm run test:e2e`) | 1 teste com 7 cenários, aprovado |
| ESLint backend e frontend | Aprovados |
| Build Vite | Aprovado |
| `git diff --check` | Sem erros |

Total: **348 execuções de testes aprovadas**. Esse total inclui os mesmos contratos
de backend executados em dois bancos; não representa 348 casos distintos. Foram
adicionados **34 testes de regressão distintos**: 30 de backend e 4 de frontend.
Os 7 cenários do navegador contam como um teste E2E, além dos 15 unitários.

Ambiente de navegador: Chrome 153, Playwright 1.61.1 instalado como dependência de
desenvolvimento, `http://127.0.0.1:5179`, API descartável em memória. Identidade da
página, conteúdo renderizado, ausência de overlay, console, seleção multiempresa,
ações e screenshots foram verificados. A interação mobile inclui abrir e fechar
o editor de nível. Respostas 401/403/409 esperadas nos testes de autorização são
tratadas separadamente de erros de execução da aplicação.

Nenhuma pendência funcional identificada nesta implementação. Deploy, execução do
CI remoto e aplicação de migrations ao banco de uso real não fizeram parte desta
validação local; o CI já existente também valida PostgreSQL 17 e containers.

## Arquivos modificados nesta retomada

Os seguintes arquivos foram criados ou complementados agora. Arquivos de schema,
repositories e outras alterações visuais já presentes foram preservados; sua
validação está incluída nos testes acima.

| Área | Arquivos |
| --- | --- |
| Autorização e eventos | `backend/src/modules/auth/auth.service.js`, `backend/src/modules/companies/companies.service.js`, `backend/src/modules/companies/companies.routes.js` |
| Runner PostgreSQL | `backend/database/test-postgres.js` |
| Regressões de backend | `backend/tests/company-roles.test.js`, `backend/tests/company-roles-migration.test.js`, `backend/tests/company-access.test.js`, `backend/tests/postgres.test.js` |
| Atualização de expectativas de schema/API | `backend/tests/auth-migration.test.js`, `backend/tests/auth.test.js`, `backend/tests/company-migration.test.js`, `backend/tests/migrations.test.js`, `backend/tests/persistence.test.js` |
| Cadastro e administração | `frontend/src/features/auth/views/RequestAccessView.vue`, `frontend/src/features/auth/views/UsersView.vue` |
| Revisão, decisões e accordion | `frontend/src/features/auth/components/AccessReviewModal.vue`, `frontend/src/features/auth/components/CompanyAccessDecisions.vue`, `frontend/src/features/auth/components/CompaniesManager.vue`, `frontend/src/features/auth/components/CompanyMembers.vue` |
| Navegação e sessão | `frontend/src/components/layout/AppSidebar.vue`, `frontend/src/services/api.js` |
| Regressões de frontend | `frontend/tests/company-access.test.js`, `frontend/tests/e2e/company-access.test.js` |
| Ferramentas e CI | `frontend/package.json`, `frontend/package-lock.json`, `frontend/vite.config.js`, `.github/workflows/ci.yaml` |
| Documentação | `backend/README.md`, `frontend/README.md`, `docs/COMPANY_ACCESS.md` |

Migrations e schema herdados e validados: `SQL/schema.sql`,
`backend/src/infrastructure/persistence/sqlite/company-roles-migration.js`,
`backend/src/infrastructure/persistence/postgres/003-company-roles.sql`, executores
`sqlite.js`/`postgres.js` e integração `check.js`/`import-sqlite.js` no mesmo diretório
de persistência. Os repositories de auth/companies, controllers, validators e
rotas empresariais herdados foram exercitados pelas regressões.
