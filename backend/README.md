# PayTrack API

Node.js 22.18+ (ou 24+) e SQLite via better-sqlite3.

```sh
npm ci
npm run seed
npm start
```

O seed é opcional, destinado ao desenvolvimento e idempotente por CPF. Ele cria clientes sem contrato, contratos ativos, parcelas personalizadas, pagamento parcial, atraso, multa pendente e contrato quitado. Executá-lo novamente não repõe pagamentos alterados nem duplica registros.

Configuração em `.env`, conforme `.env.example`. O banco padrão é `backend/database/paytrack.db`; os testes usam bancos isolados. O frontend Vite encaminha `/api` para `http://127.0.0.1:3000`.

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
