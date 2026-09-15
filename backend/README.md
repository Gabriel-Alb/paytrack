# PayTrack API

Node.js 22.18+ (ou 24+). PostgreSQL é obrigatório em produção; SQLite via better-sqlite3 é usado apenas em desenvolvimento local e testes.

```sh
npm ci
npm run seed
npm start
```

O seed é opcional, destinado ao desenvolvimento e idempotente por CPF. Ele cria clientes sem contrato, contratos ativos, parcelas personalizadas, pagamento parcial, atraso, multa pendente e contrato quitado. Executá-lo novamente não repõe pagamentos alterados nem duplica registros.

Configuração conforme `.env.example`. O `.env` local é carregado somente no desenvolvimento; produção recebe variáveis do processo e os testes definem seu próprio ambiente. O banco local padrão é `backend/database/paytrack.db`; os testes usam bancos isolados. O frontend Vite encaminha `/api` para `http://127.0.0.1:3000`.

## Autenticação e produção

Veja [SECURITY.md](SECURITY.md) para configuração, limites, migração e riscos restantes.
Todas as rotas financeiras abaixo exigem usuário ativo e sessão válida. Escritas também exigem CSRF e Origin/Referer autorizado.

Crie o primeiro administrador dentro de `backend`, em um terminal interativo:

```sh
npm run auth:create-master
```

O comando pergunta nome, e-mail, CPF, RG/CNH opcionais e senha com confirmação sem eco.
Não aceita argumentos nem senha padrão; recusa novo bootstrap quando já existe um administrador. Execute no banco correto definido em `.env`.
Após isso, abra `/login`. Pessoas novas usam `/request-access`; administradores avaliam pela notificação ou em `/users`.
`/account` exibe nome, e-mail, CPF e RG reais e permite editar somente o e-mail. A troca de senha exige a senha atual e encerra todas as sessões.

| Acesso | Método e caminho |
| --- | --- |
| Público | `GET /api/health`, `GET /api/auth/csrf` |
| Público com CSRF e rate limit | `POST /api/auth/login`, `POST /api/auth/request-access` |
| Autenticado | `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/logout-all`, `POST /api/auth/change-password` |
| Administrador | `GET /api/users?status=pending&page=1`, `GET /api/users/:id`, `PATCH /api/users/:id/access` |

O PATCH administrativo aceita `{ "action": "approve", "role": "user", "companyIds": [1, 2] }` na aprovação e `{ "action": "edit", "role": "user", "companyIds": [1] }` para editar permissões de usuários ativos ou bloqueados. O papel padrão na aprovação é `user`, com ao menos uma empresa obrigatória. Para acesso global use `role: "admin"`; vínculos são opcionais. As ações `reject`, `block` e `unblock` aceitam somente `action`. Ninguém altera o próprio acesso; qualquer administrador pode administrar os demais, preservando pelo menos um administrador ativo.
`PATCH /api/auth/me` aceita somente `{ "email": "novo@example.com" }`; rejeita CPF, RG, role e quaisquer outros campos. E-mail duplicado responde `409 EMAIL_CONFLICT`.
Não há rota de criação pública de administrador. Solicitações gravadas respondem `202`. Duplicidades no pré-cadastro respondem `409 ACCESS_REQUEST_CONFLICT`, sem identificar qual campo conflitou; nenhum segundo registro é criado.

## Organização

Os módulos mantêm rota → controller → service → contrato de repository. Os arquivos `src/modules/*/*.repository.js` são contratos assíncronos; os services não importam drivers, executam SQL ou selecionam banco. `src/application/persistence.js` fornece as portas de repositories e unidade de trabalho, configuradas somente no bootstrap `src/config/database.js`. A implementação SQL única por módulo fica em `src/infrastructure/persistence/repositories`; os adapters PostgreSQL e SQLite implementam a mesma interface. `src/shared` mantém validações, datas e erros; funções monetárias comuns continuam em `../shared/money.js`.

`../SQL/schema.sql` é a fonte do schema. Inicialização e migrações são transacionais, preservam os pagamentos existentes e verificam as chaves estrangeiras antes de confirmar. A migração antiga de pagamentos lê a definição da tabela desse mesmo arquivo.

Cadastros de clientes, empréstimos e pagamentos preenchem `created_by` a partir da sessão autenticada. A auditoria existente também registra ID e nome do responsável no momento da ação, entidade afetada e detalhes para notificações. Inclui edições de cadastro/contrato/parcelas, correções, estornos e recebimentos de multa, na mesma transação da operação. Payloads não aceitam responsáveis. O histórico de pagamentos usa o nome persistido; registros antigos sem autoria permanecem sem atribuição inventada.

Administradores recebem essas ações em `/api/notifications`, nas categorias Cadastros, Empréstimos e Pagamentos. As notificações preservam o cliente e os dados da ação, incluindo valor, quantidade de parcelas, data do empréstimo e último vencimento. A versão 4 do banco amplia `auth_audit_logs`; reutiliza os campos `created_by` existentes.

## Endpoints

Todos os caminhos abaixo começam com `/api`.

| Método | Caminho | Operação |
| --- | --- | --- |
| GET | `/health` | Saúde da API |
| GET, POST | `/clients` | Listar e cadastrar clientes |
| GET, PATCH, PUT | `/clients/:id` | Consultar e atualizar cliente |
| GET, POST | `/loans` | Listar e criar contratos |
| GET, PATCH | `/loans/:id` | Consultar, editar observações ou cancelar |
| GET, PATCH | `/loans/:id/installments` | Consultar e ajustar parcelas sem recebimentos |
| PUT | `/loans/:id/payment-confirmation` | Confirmar seleção do modal, corrigir e estornar |
| POST | `/installments/:id/payments` | Pagamento parcial ou complementação |
| POST | `/installments/:id/payment-preview` | Calcular multa na data do pagamento |
| GET | `/late-fees/:id` | Consultar multa |
| POST | `/late-fees/:id/payments` | Receber multa separadamente |
| GET | `/dashboard/summary` | Resumo, recebimentos e próximos pagamentos |
| GET | `/reports` | Relatório por período |
| GET | `/notifications` | Recebimentos e atrasos recentes |

Listas aceitam `page`, `limit` (até 100), `search` e `status`. Clientes e empréstimos também aceitam `company_id`; empréstimos aceitam `client_id`. Um filtro nunca amplia as empresas autorizadas. Relatórios exigem `start` e `end` (`YYYY-MM-DD`) e aceitam `mode=day|week|month`, `status=all|paid|partial|unpaid`, `sort` e `direction`. Totais do relatório consideram todo o período, independentemente da paginação; o gráfico agrupa pela data efetiva dos recebimentos.

## Regras financeiras

- Valores monetários da API e do banco são inteiros em centavos. Percentual de juros aceita até duas casas decimais.
- Parcelas são diárias, a partir de `first_due_date`. `installments` aceita todos os valores; `installment_overrides` usa índices iniciados em zero e distribui o restante em centavos. A soma deve coincidir com o total, com todas as parcelas positivas.
- Pagamentos, ajustes e cancelamento exigem a `revision` recebida na consulta do contrato. Revisão desatualizada retorna `409 STALE_LOAN`.
- O modal envia a seleção completa de parcelas quitadas. Retirar uma parcela quitada estorna seus recebimentos com `voided_at`; nenhum pagamento é apagado. Parcelas parciais não selecionadas permanecem intactas.
- A multa diária é independente da parcela e para de crescer na data de quitação da parcela. Contrato só fica quitado quando parcela e multa estiverem liquidadas.
- O limiar de pequeno atraso é definido somente por `ATTENTION_DAYS` (padrão: 2). Negativação manual usa `status_override`; os demais status derivam dos contratos.
- Operações financeiras usam unidade de trabalho assíncrona; falhas desfazem pagamentos, parcelas, multas, status e revisão juntos.

## Validação

```sh
npm test
npm run lint
```

Testes cobrem documentos duplicados, valores e parcelas, pagamentos, multa, status, concorrência, estorno, relatórios, seed, migrations, isolamento de empresas e rollback com falhas injetadas em ambos os bancos. O frontend tem `npm run lint` e `npm run build` próprios.

## Desenvolvimento na rede local

Execute `npm run dev` no frontend e backend. O Vite escuta em `0.0.0.0`; abra `http://IP-DA-MAQUINA:5173` no celular e mantenha `VITE_API_URL` vazio para usar `/api` pelo proxy. O backend pode continuar em `HOST=127.0.0.1`. Em `NODE_ENV=development`, CORS e Origin/Referer aceitam localhost e os IPv4 privados das interfaces da máquina, usando o protocolo e a porta de `FRONTEND_ORIGIN`. Reinicie o backend se o IP mudar. Em produção, somente a origem HTTPS exata configurada é aceita.

O Controle de Acesso consulta os usuários pendentes persistidos e recebe atualizações por `GET /api/users/events` (SSE, exclusivo de administradores). Solicitação e decisão confirmadas atualizam a lista aberta; reconexões e uma verificação a cada 15 segundos também sincronizam alterações de outro processo.

## Acesso por empresa (SQLite v6 / PostgreSQL v2)

Há somente dois papéis: `admin` (Administrador global) e `user` (Usuário padrão). O comando histórico `auth:create-master` agora cria um administrador; não existe mais papel master. Usuários padrão ativos recebem uma ou mais empresas através de `user_companies` (relação muitos-para-muitos).

- `GET /api/companies`: empresas disponíveis na sessão; administradores recebem todas.
- `POST /api/companies`: somente administradores, corpo `{"name":"Nova empresa"}`.
- `GET /api/auth/me` e o detalhe de usuário retornam `companies` e `companyIds`.
- `POST /api/clients` cadastra um cliente global, sem campo de empresa. `POST /api/loans` aceita `company_id`. Administradores e usuários com várias empresas precisam informar a empresa. Para usuário padrão com uma empresa, a API pode preenchê-la automaticamente.
- O mesmo cliente pode ter contratos de empresas diferentes. Novos cadastros e alterações de documentos respeitam unicidade global de CPF/RG/CNH. Duplicados legados são preservados, sem fusão automática.

`loans.company_id` é obrigatório e referencia `companies`. Clientes não pertencem a empresas. Parcelas herdam o escopo de seu contrato, e pagamentos/multas da parcela. A empresa e o cliente do contrato são imutáveis. O histórico e os totais financeiros do cliente incluem apenas contratos autorizados na sessão.

As três listagens usam os status existentes da API: `status=active` reúne contratos `active`/`overdue`; `status=paid` exige quitação do principal e das multas; `status=overdue` usa o limiar de atraso configurado. Somente administradores veem filtros de empresa na interface; parâmetros enviados por usuários nunca ampliam o escopo.

O middleware `companyAccess` cria um contexto por requisição (AsyncLocalStorage), após resolver a sessão no banco. Todos os repositórios financeiros consultam as views `scoped_*`, que filtram antes de agregar ou paginar. Triggers também validam os donos de cada escrita, inclusive reconciliações. Consultas por ID não autorizado retornam 404; criação com empresa não disponível retorna 403. Ao adicionar uma consulta financeira, use as views, nunca uma leitura direta da tabela base. No SQLite, views e guardas são temporárias por conexão. No PostgreSQL, são versionadas no schema, e cada transação recebe o contexto por `set_config(..., true)`; o contexto expira no commit/rollback e não vaza pelo pool. Fora de HTTP, scripts são operações privilegiadas. A credencial PostgreSQL e o arquivo SQLite devem continuar restritos à conta de serviço.

Alterar papel ou empresas com `action: "edit"` preserva a sessão, mas vale já na próxima requisição: papel e vínculos são lidos novamente do banco. Bloqueio continua revogando as sessões. A SPA atualiza o perfil na navegação e consulta novamente as empresas ao abrir o cadastro.

### Migração dos dados existentes

A inicialização de bancos SQLite legados aplica `src/infrastructure/persistence/sqlite/company-migration.js` automaticamente dentro de uma transação. Cria Dinheiro Express (ID 1) e Platinum Finance (ID 2) como registros no banco; o frontend não fixa esses nomes.

Bancos anteriores à v5 recebem a atribuição legada à Dinheiro Express antes da transferência da empresa para os empréstimos. A v6 copia `clients.company_id` para cada contrato e remove a coluna do cliente. No PostgreSQL, `002-loan-companies.sql` faz a mesma transformação sem alterar o checksum da migration inicial. IDs, dados cadastrais, saldos, autoria, pagamentos, sessões e vínculos são preservados.

A reconstrução preserva inclusive clientes legados com documentos repetidos. Guardas de documentos impedem novos duplicados e permitem editar os demais campos desses registros. A inicialização desativa chaves estrangeiras somente nessa conexão, verifica todas as referências antes do commit e reativa a fiscalização antes de atender HTTP. Em falha, a transação reverte a migração. Faça backup consistente e valide uma cópia do banco antes de iniciar a versão nova em produção. A atribuição inicial precisa corresponder à operação real; redistribuição de dados legados, se necessária, deve ser planejada antes da migração.

## PostgreSQL em produção

Injete no ambiente do processo:

```dotenv
NODE_ENV=production
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://paytrack:senha@host:5432/paytrack
DATABASE_SSL=verify-full
DATABASE_POOL_MAX=10
DATABASE_CONNECT_TIMEOUT_MS=10000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_STATEMENT_TIMEOUT_MS=30000
FRONTEND_ORIGIN=https://seu-dominio
```

`DATABASE_SSL_CA` permite informar um arquivo PEM para CA privada. A validação do certificado permanece ativa. Use `DATABASE_SSL=disable` apenas quando TLS não for usado na conexão explicitamente configurada (por exemplo, PostgreSQL de teste em loopback). Não misture parâmetros SSL na URL. Sem `DATABASE_CLIENT`, produção seleciona PostgreSQL e desenvolvimento/teste selecionam SQLite. Produção recusa SQLite e caminhos como `:memory:`; URL ausente/inválida e configurações numéricas inválidas interrompem a inicialização. Não há fallback silencioso.

`npm ci --omit=dev` instala o runtime de produção com `pg`; `better-sqlite3` é dependência de desenvolvimento e carregada dinamicamente somente pelo adapter SQLite. O banco PostgreSQL deve existir, e a credencial de implantação precisa criar tabelas, funções, views, triggers e índices no schema `public`. Não é necessária extensão nem credencial superuser. Após as migrations, um usuário de runtime pode receber privilégios de uso do schema, funções, sequências e DML nas tabelas; como o bootstrap verifica/cria a tabela de versões, o procedimento mais simples nesta versão é manter a mesma credencial de implantação, com acesso limitado ao banco PayTrack.

Comandos dentro de `backend`:

- `npm run db:migrate`: aplica migrations e encerra; a inicialização da API também as aplica antes de aceitar requisições.
- `npm run db:check`: inicializa/migra e verifica tabelas, versão, integridade/FKs do SQLite e constraints validadas no PostgreSQL.
- `npm run auth:create-master`: bootstrap interativo, sem senha padrão, válido nos dois bancos.
- `npm run seed`: dados demonstrativos opcionais, idempotentes e recusados em produção, inclusive por chamada direta à função.

A migration PostgreSQL `src/infrastructure/persistence/postgres/001-initial.sql` cria as 11 tabelas, índices de FKs, unicidade normalizada, empresas iniciais, views, funções e guardas. `schema_migrations` registra versão, checksum SHA-256 e data; aplicação é transacional e usa lock entre processos. Versões futuras e checksums divergentes são recusados. Não edite uma migration já aplicada: crie a próxima versão e registre-a no runner. SQLite usa a versão 6 e suas migrations legadas, preservando IDs e dados existentes.

### Tipos e concorrência

IDs, referências, centavos e horários em milissegundos usam BIGINT no PostgreSQL; percentuais usam NUMERIC. O parser do pool retorna números para preservar os contratos JSON e recusa valores além de Number.MAX_SAFE_INTEGER. Datas civis permanecem TEXT ISO `YYYY-MM-DD` e timestamps textuais UTC, preservando importações e o formato da API; a validação de calendário permanece no Zod. `day_number` converte datas para cálculo de dias sem fuso; `utc_now` preserva timestamps UTC. Rateio usa inteiros BigInt no SQLite e NUMERIC exato no PostgreSQL. Não há ponto flutuante intermediário nos cálculos de centavos.

As queries comuns usam GROUP BY explícito, CASE para contagens condicionais, comparações ASCII equivalentes ao NOCASE original, escape explícito nas buscas, ordenação de nulos definida e aliases com aspas e funções equivalentes nos adapters. Parâmetros são vinculados, inclusive valores nulos; o binder só converte placeholders e não reescreve regras SQL.

Uma transação `pg` usa um único client do pool até commit/rollback, conforme a [documentação do driver](https://node-postgres.com/features/transactions). Savepoints preservam operações aninhadas e consultas financeiras revertidas. SQLite serializa operações na conexão com BEGIN IMMEDIATE. Como a reconciliação existente atualiza o portfólio acessível inteiro, as unidades de trabalho PostgreSQL usam um advisory lock comum antes das leituras de negócio; isso preserva a revisão otimista e evita pagamentos concorrentes duplicados entre processos. É uma escolha conservadora: unidades financeiras são serializadas, e eventual paralelismo por contrato exige primeiro reduzir o alcance da reconciliação. Rate limit continua usando UPSERT atômico independente. Sequences PostgreSQL podem ter lacunas após rollback, como é normal nesse banco.

### Transferência SQLite → PostgreSQL

1. Pare as escritas da aplicação antiga e faça backup consistente do SQLite, incluindo o conteúdo do WAL. Trabalhe com uma cópia, nunca com o único arquivo original.
2. Se a cópia for anterior à v6, inicialize-a com NODE_ENV=development, DATABASE_CLIENT=sqlite e DATABASE_PATH apontando para a cópia; execute `npm run db:migrate` e `npm run db:check`. Valide a atribuição das empresas legadas descrita acima.
3. Prepare um PostgreSQL vazio com as configurações de produção e execute `npm run db:migrate`. Para a transferência offline, instale também as dependências de desenvolvimento (`npm ci --include=dev`), pois o leitor SQLite é necessário apenas nesse comando.
4. Execute `npm run db:import-sqlite -- /caminho/da/copia-v6.db`, mantendo o destino configurado como PostgreSQL. O comando abre a origem somente para leitura, valida versão/integridade/FKs, recusa destino com dados ou empresas alteradas e importa todas as tabelas em uma transação. Preserva usuários, senhas/hashes, sessões, vínculos, autoria, pagamentos estornados, auditoria e rate limits. Ajusta as sequences considerando também IDs antigos já removidos.
5. Execute `npm run db:check`, compare contagens e valide login, empresas e saldos antes de liberar escritas na nova API. Mantenha o backup original. Uma segunda importação no mesmo destino é recusada; erros revertem os registros e permitem repetir no destino vazio.

A mudança de configuração não transfere dados automaticamente. A importação não mescla bancos e não modifica o arquivo original. Após a transferência, o runtime pode voltar a `npm ci --omit=dev`.

### Validação com PostgreSQL real

`npm test` executa a suíte local com SQLite isolado e testes de arquitetura/configuração. Defina `TEST_DATABASE_URL` no ambiente para um PostgreSQL exclusivo de testes e execute `npm run test:postgres`. O runner recusa URL ausente. Os testes criam schemas aleatórios e removem somente esses schemas ao terminar; a credencial precisa de CREATE SCHEMA. A suíte reutiliza os mesmos fluxos HTTP de autenticação, acesso, empresas, finanças e relatórios, além de transações, concorrência, schema, migrations e importação. Não use um banco de produção para testes.
