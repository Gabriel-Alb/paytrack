# PayTrack API

Node.js 22.18+ (ou 24+) e SQLite via better-sqlite3.

```sh
npm ci
npm run seed
npm start
```

O seed é opcional, destinado ao desenvolvimento e idempotente por CPF. Ele cria clientes sem contrato, contratos ativos, parcelas personalizadas, pagamento parcial, atraso, multa pendente e contrato quitado. Executá-lo novamente não repõe pagamentos alterados nem duplica registros.

Configuração em `.env`, conforme `.env.example`. O banco padrão é `backend/database/paytrack.db`; os testes usam bancos isolados. O frontend Vite encaminha `/api` para `http://127.0.0.1:3000`.

## Autenticação e produção

Veja [SECURITY.md](SECURITY.md) para configuração, limites, migração e riscos restantes.
Todas as rotas financeiras abaixo exigem usuário ativo e sessão válida. Escritas também exigem CSRF e Origin/Referer autorizado.

Crie o primeiro administrador dentro de `backend`, em um terminal interativo:

```sh
npm run auth:create-master
```

O comando pergunta nome, e-mail, CPF, RG/CNH opcionais e senha com confirmação sem eco.
Não aceita argumentos nem senha padrão; recusa outro master. Execute no banco correto definido em `.env`.
Após isso, abra `/login`. Pessoas novas usam `/request-access`; o master avalia pela notificação ou em `/users`.
`/account` permite trocar senha com a senha atual e encerra todas as sessões.

| Acesso | Método e caminho |
| --- | --- |
| Público | `GET /api/health`, `GET /api/auth/csrf` |
| Público com CSRF e rate limit | `POST /api/auth/login`, `POST /api/auth/request-access` |
| Autenticado | `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/logout-all`, `POST /api/auth/change-password` |
| Master | `GET /api/users?status=pending&page=1`, `GET /api/users/:id`, `PATCH /api/users/:id/access` |

O PATCH administrativo aceita apenas `{ "action": "approve" }`, `reject`, `block` ou `unblock`.
Não há rota de criação pública de master nem alteração de role. Solicitações gravadas respondem `202`. Duplicidades no pré-cadastro respondem `409 ACCESS_REQUEST_CONFLICT`, sem identificar qual campo conflitou; nenhum segundo registro é criado.

## Organização

`src/modules/{clients,loans,installments,payments,late-fees,overview}` segue rota → controller → service → repository → SQLite. Os endpoints de pagamentos ficam nas rotas de contratos, parcelas e multas. `src/config` inicializa SQLite e aplica migrations; `src/shared` contém validações, datas e erros. As funções monetárias comuns ficam em `../shared/money.js`.

`../SQL/schema.sql` é a fonte do schema. Inicialização e migrações são transacionais, preservam os pagamentos existentes e verificam as chaves estrangeiras antes de confirmar. A migração antiga de pagamentos lê a definição da tabela desse mesmo arquivo.

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

Listas aceitam `page`, `limit` (até 100), `search` e `status`. Empréstimos também aceitam `client_id`. Relatórios exigem `start` e `end` (`YYYY-MM-DD`) e aceitam `mode=day|week|month`, `status=all|paid|partial|unpaid`, `sort` e `direction`. Totais do relatório consideram todo o período, independentemente da paginação; o gráfico agrupa pela data efetiva dos recebimentos.

## Regras financeiras

- Valores monetários da API e do banco são inteiros em centavos. Percentual de juros aceita até duas casas decimais.
- Parcelas são diárias, a partir de `first_due_date`. `installments` aceita todos os valores; `installment_overrides` usa índices iniciados em zero e distribui o restante em centavos. A soma deve coincidir com o total, com todas as parcelas positivas.
- Pagamentos, ajustes e cancelamento exigem a `revision` recebida na consulta do contrato. Revisão desatualizada retorna `409 STALE_LOAN`.
- O modal envia a seleção completa de parcelas quitadas. Retirar uma parcela quitada estorna seus recebimentos com `voided_at`; nenhum pagamento é apagado. Parcelas parciais não selecionadas permanecem intactas.
- A multa diária é independente da parcela e para de crescer na data de quitação da parcela. Contrato só fica quitado quando parcela e multa estiverem liquidadas.
- O limiar de pequeno atraso é definido somente por `ATTENTION_DAYS` (padrão: 2). Negativação manual usa `status_override`; os demais status derivam dos contratos.
- Operações financeiras usam transação SQLite imediata; falhas desfazem pagamentos, parcelas, multas, status e revisão juntos.

## Validação

```sh
npm test
npm run lint
```

Testes cobrem documentos duplicados, valores e parcelas, pagamentos, multa, status, concorrência, estorno, relatórios, seed, migração e rollback por falhas injetadas no SQLite. O frontend tem `npm run lint` e `npm run build` próprios.

## Desenvolvimento na rede local

Execute `npm run dev` no frontend e backend. O Vite escuta em `0.0.0.0`; abra `http://IP-DA-MAQUINA:5173` no celular e mantenha `VITE_API_URL` vazio para usar `/api` pelo proxy. O backend pode continuar em `HOST=127.0.0.1`. Em `NODE_ENV=development`, CORS e Origin/Referer aceitam localhost e os IPv4 privados das interfaces da máquina, usando o protocolo e a porta de `FRONTEND_ORIGIN`. Reinicie o backend se o IP mudar. Em produção, somente a origem HTTPS exata configurada é aceita.

O Controle de Acesso consulta os usuários pendentes persistidos e recebe atualizações por `GET /api/users/events` (SSE, exclusivo do master). Solicitação e decisão confirmadas atualizam a lista aberta; reconexões e uma verificação a cada 15 segundos também sincronizam alterações de outro processo.
