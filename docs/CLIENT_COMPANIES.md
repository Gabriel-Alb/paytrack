# Clientes vinculados a empresas

## Comportamento e contrato da API

Clientes mantêm seus IDs e dados cadastrais. `client_companies(client_id, company_id)`
permite várias empresas, com chave primária composta, FKs restritivas e índice por
empresa. A tabela não altera a propriedade dos empréstimos.

- `POST /api/clients` exige `companyIds: [1]` (ou várias empresas). Todos os IDs são
  validados contra o contexto autenticado e empresas existentes, antes de gravar.
- `GET /api/clients`, busca, paginação, filtro `company_id`, detalhes e histórico
  usam `scoped_clients`. Usuários sem vínculo não veem clientes. IDs fora do escopo
  retornam 404. Os totais também são filtrados.
- Respostas incluem `companies: [{ id, name }]` e `companyIds`. Usuários comuns
  recebem somente os vínculos que podem acessar, inclusive em clientes compartilhados.
- `PATCH`/`PUT /api/clients/:id`: usuários podem editar o cadastro visível, mas não
  enviar `companyIds`. Somente `users.role=admin` gerencia vínculos. `MANAGER` não
  equivale a admin global. Dados cadastrais de um cliente compartilhado continuam
  sendo um único cadastro; sua edição é vista pelas empresas vinculadas.
- Admin pode substituir vínculos por uma lista não vazia. Um vínculo utilizado por
  qualquer empréstimo, inclusive quitado/cancelado, não pode ser removido (409).
  Outros vínculos podem ser acrescentados ou removidos sem mudar o histórico.
- Cliente + empresa são validados na criação e edição de empréstimos, inclusive
  por admin. Para transferir um empréstimo, vincule primeiro o cliente à empresa
  de destino. Não há associação automática silenciosa durante essa operação.
- Campos alternativos como `companyId`/`company_id` no corpo de cliente são
  rejeitados; o contrato usa `companyIds`. O filtro de listagem mantém `company_id`.
- Criação, edição, vínculos e auditoria usam a transação existente. Falhas revertem
  a operação inteira. CPF/RG/CNH mantêm as regras de unicidade já existentes.

O formulário usa somente `/api/companies`, já filtrado pelo backend. Admin edita
vínculos; usuário os consulta. A listagem identifica clientes sem empresa. A busca
de clientes no formulário de empréstimo filtra pela empresa selecionada.

## Migration e dados existentes

- PostgreSQL: **007-client-companies.sql**, após v6; runner com transação, advisory
  lock e checksum. Nenhuma migration anterior foi modificada.
- SQLite: **v11**, `sqlite/client-company-migration.js`, dentro da transação de
  inicialização existente; definição incluída em `SQL/schema.sql`.
- Cria somente a tabela/índice de vínculos; `SELECT DISTINCT client_id, company_id
  FROM loans` preenche a associação com `ON CONFLICT DO NOTHING`.
- Todos os empréstimos existentes participam, independentemente do status. Cliente
  com empréstimos em A e B recebe ambos os vínculos.
- Cliente sem empréstimos permanece com seus dados e ID, sem empresa inventada.
  Fica visível ao admin, que abre **Clientes → Editar → Empresas vinculadas**,
  seleciona a(s) empresa(s) correta(s) e salva. Não precisa recriar o cliente.
- O backfill não atualiza clientes, empréstimos, parcelas, multas, pagamentos,
  sequências ou auditoria. Atualiza a view protegida e adiciona proteção de escrita
  em clientes, seguindo o mecanismo existente de acesso.
- Reexecutar o runner não duplica vínculos. SQLite também testa a repetição direta
  do backfill. Não há rotina periódica de reatribuição ao reiniciar v11.
- Importação SQLite→PostgreSQL continua explícita/offline: copia vínculos v11;
  para origens v6–v10, deriva os vínculos dos empréstimos importados. Não execute
  importação para atualizar um banco PostgreSQL de produção existente.

## Publicação segura em produção existente

Os comandos abaixo são instruções para execução posterior, **não foram executados
em produção**. Preservar os volumes, credenciais, projeto Compose e overlays TLS
existentes. Os exemplos usam o arquivo externo de ambiente já documentado em
`DEPLOY.md`. Se a instalação usa outro caminho/overlay, usar os mesmos parâmetros
da implantação atual em **todos** os comandos.

1. Validar primeiro em homologação com cópia protegida do banco e conferir que a
   versão atual é PostgreSQL v6. Esta migration é a v7 incremental. Bases mais
   antigas também executam migrations pendentes anteriores, que exigem sua própria
   revisão. Conferir tamanho do banco e tempo de execução antes da janela.
2. Preparar as imagens desta revisão (ou puxar as imagens imutáveis aprovadas).
   No fluxo de build local existente, a partir da raiz do projeto:

   ```sh
   docker compose --env-file /opt/paytrack/production.env build backend frontend
   ```

3. Abrir janela de manutenção e interromper **todos** os processos antigos da API
   e tarefas que escrevem no banco antes do backup/backfill. No Compose único:

   ```sh
   docker compose --env-file /opt/paytrack/production.env stop backend
   ```

   Isso evita que a API antiga crie clientes sem vínculo entre a migration e a
   atualização. Não usar o deploy genérico com API antiga escrevendo nessa janela.
4. Criar backup com `pg_dump --format=custom` e verificar a cópia, conforme
   [Backup e restauração](DEPLOY.md#backup-e-restauração). Registrar versão das
   imagens/schema e contagens antes da migration. PostgreSQL permanece ativo.
5. Aplicar pelo serviço existente e validar com a imagem nova:

   ```sh
   docker compose --env-file /opt/paytrack/production.env run --rm --no-deps migrate
   docker compose --env-file /opt/paytrack/production.env run --rm --no-deps backend npm run db:check
   ```

   Fora de Docker, com as variáveis do banco correto já configuradas no ambiente,
   executar em `backend/`: `npm ci --omit=dev`, `npm run db:migrate`,
   `npm run db:check`. Publicar backend e frontend juntos. Em hospedagem gerenciada,
   usar a fase de migration/pre-deploy existente e a mesma janela sem escritas.
6. Conferir v7 e integridade com consultas **somente de leitura** no console do banco:

   ```sql
   SELECT MAX(version) FROM schema_migrations;
   SELECT COUNT(*) FROM clients;
   SELECT COUNT(*) FROM loans;
   SELECT COUNT(*) FROM installments;
   SELECT COUNT(*) FROM payments;
   SELECT COUNT(*) FROM late_fees;
   SELECT COUNT(*) AS loans_without_link FROM loans l
   WHERE NOT EXISTS (SELECT 1 FROM client_companies cc
     WHERE cc.client_id=l.client_id AND cc.company_id=l.company_id);
   SELECT COUNT(*) AS clients_awaiting_assignment FROM clients c
   WHERE NOT EXISTS (SELECT 1 FROM client_companies cc WHERE cc.client_id=c.id);
   ```

   As cinco contagens devem permanecer iguais às anteriores; `loans_without_link`
   deve ser zero. Clientes aguardando vinculação são esperados e não são apagados.
7. Iniciar os dois serviços atualizados e conferir saúde:

   ```sh
   docker compose --env-file /opt/paytrack/production.env up -d --no-deps --wait backend frontend
   docker compose --env-file /opt/paytrack/production.env ps
   ```

   Verificar `/api/health` no domínio real, login de admin/usuário, listagem de
   clientes, históricos, parcelas e pagamentos. Só então encerrar a manutenção.
8. Admin vincula manualmente os clientes antigos sem empréstimos pela interface.

Não executar seed, reset, importação sobre produção, `down -v` ou restauração sobre
o banco ativo. A nova migration preserva os dados, mas o validador existente exige
schema exato: a imagem antiga (v6) não inicia sobre v7. Não prometer rollback só de
código. Em falha antes do commit, a transação reverte; após commit, preferir correção
adiante ou recuperação planejada em outra instância, conforme `DEPLOY.md`.

## Arquivos envolvidos

- `SQL/schema.sql`; `backend/src/infrastructure/persistence/postgres/007-client-companies.sql`;
  `sqlite/client-company-migration.js`; runners `postgres.js`/`sqlite.js`;
  `sqlite/company-access.js`, `check.js` e `import-sqlite.js`.
- Repository de clientes em infraestrutura e fachada do módulo; service e validator
  de clientes; service de empréstimos. Rotas/controllers/contexto existentes reutilizados.
- `ClientFormModal.vue`, `ClientsGrid.vue`, `LoanFormModal.vue`, `LoansView.vue`.
- Novos testes `client-companies.test.js`, `client-companies-migration.test.js`
  e `frontend/tests/e2e/client-companies.test.js`; fixtures/expectativas dos testes
  existentes atualizadas para informar empresas e reconhecer as novas versões.
- `backend/database/test-postgres.js`, seed exclusivamente de desenvolvimento e
  documentação `COMPANY_ACCESS.md`/este arquivo.

As alterações locais preexistentes de pagamentos foram preservadas.

Testes existentes ajustados: `backend/tests/activity.test.js`,
`auth-migration.test.js`, `company-access.test.js`, `company-migration.test.js`,
`company-roles-migration.test.js`, `financial.test.js`, `migrations.test.js`,
`password-recovery-migration.test.js`, `persistence.test.js`, `postgres.test.js`,
`frontend/tests/e2e/loan-editing.test.js` e `payments.test.js`.

## Validação local

- `backend`: `npm test` — 237 testes, 234 aprovados, 3 pulados, nenhuma falha.
  As verificações PostgreSQL condicionais são executadas na suíte específica abaixo.
- `backend`: `npm run test:postgres`, com `TEST_DATABASE_URL` apontando exclusivamente
  para uma instância local temporária PostgreSQL **18.4** — 218/218 aprovados.
  Após fortalecer as asserções de rollback, os testes afetados foram executados
  novamente nos dois bancos e passaram.
- `frontend`: `npm test` — 21/21 aprovados; lint dos dois projetos e build com
  `VITE_API_URL=/api` aprovados. `git diff --check` sem erros.
- `frontend`: `node --test --test-concurrency=1 tests/e2e/*.test.js` — 5/5 aprovados.
  Playwright com Chrome local (plugin Browser não disponível), app descartável
  `http://127.0.0.1:5186`, viewports 1440×1000 e 390×844 no novo fluxo.
  Identidade/conteúdo, ausência de overlay, console, capturas e interações aprovados.
  Fluxo: Clientes → Novo cliente → empresas permitidas → salvar; admin → editar
  cliente antigo → vincular A+B; empréstimo → selecionar empresa → busca filtrada.
  As regressões de administração, edição de empréstimos, recuperação de senha e
  pagamentos também passaram. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` apontou para o
  Chrome instalado, sem adicionar dependências.
- Migração: snapshots completos de clientes, empréstimos, parcelas, pagamentos
  (incluindo estornos), multas e sequências; órfão preservado, várias empresas,
  contratos quitados/cancelados, repetição sem duplicados e rollback PostgreSQL
  com falha injetada após criação/backfill.
- Não houve conexão com produção. Compose usa PostgreSQL 17; validar a release em
  homologação na mesma versão/configuração da instalação antes de publicar.
