import { injectFailure } from './database-helper.js';
import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase, database } from './database-helper.js';
import { today, addDays } from '../src/shared/utils/dates.js';
import { env } from '../src/config/env.js';
import { seedDevelopment } from '../database/seed.js';
import { createMaster } from '../src/modules/auth/auth.service.js';
import { randomBytes } from 'node:crypto';
import { refreshFinancialState } from '../src/modules/installments/installments.service.js';

let api;
const clientData = {
  companyIds: [1,2],
  name: 'Cliente de teste',
  cpf: '529.982.247-25',
  rg: '12.345-X',
  cnh: '12345678901',
};
beforeEach(async () => {
  (await openDatabase(':memory:'));
  const password=randomBytes(15).toString('base64url');
  await createMaster({name:'Test Master',email:'master@example.test',cpf:'12345678909',password});
  api=request.agent(app);
  const csrf=(await api.get('/api/auth/csrf')).body.csrfToken;
  const login=await api.post('/api/auth/login').set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',csrf).send({email:'master@example.test',password}).expect(200);
  api.set('Origin',env.FRONTEND_ORIGIN);
  api.set('X-CSRF-Token',login.body.csrfToken);
});
afterEach(closeDatabase);
async function client(data = {}) {
  return (
    await api
      .post('/api/clients')
      .send({ ...clientData, ...data })
      .expect(201)
  ).body;
}
async function loan(data = {}) {
  const c = await client();
  return (
    await api
      .post('/api/loans')
      .send({
        company_id: 1,
        client_id: c.id,
        principal_amount: 10000,
        interest_percentage: '10',
        installment_count: 3,
        late_fee_per_day: 125,
        loan_date: addDays(today(), -10),
        first_due_date: today(),
        ...data,
      })
      .expect(201)
  ).body;
}
async function pay(l, amount, date = today()) {
  return (
    await api
      .post(`/api/installments/${l.installments[0].id}/payments`)
      .send({ amount, payment_date: date, revision: l.revision })
      .expect(201)
  ).body.loan;
}
const select = (number, fee = 0, date = today()) => ({
  installment_number: number,
  payment_date: date,
  late_fee_received_amount: fee,
});
async function confirm(l, payments, status = 200) {
  return (
    await api
      .put(`/api/loans/${l.id}/payment-confirmation`)
      .send({ revision: l.revision, payments })
      .expect(status)
  ).body;
}
async function snapshot() {
  return (await Promise.all(['clients', 'loans', 'installments', 'payments', 'late_fees'].map(async (table) =>
    (await database().prepare(`SELECT * FROM ${table}`).all()),
  )));
}

test('cria cliente e normaliza documentos e campos opcionais', async () => {
  const c = await client({ email: 'TESTE@EXAMPLE.COM' });
  assert.equal(c.cpf, '52998224725');
  assert.equal(c.rg, '12345X');
  assert.equal(c.email, 'teste@example.com');
  assert.equal(c.status, 'sem_contrato');
  await api.patch(`/api/clients/${c.id}`).send({ phone: '(11) 99999-0000' }).expect(200);
  assert.equal((await api.get(`/api/clients/${c.id}`)).body.phone, '11999990000');
  assert.equal((await api.get(`/api/clients/${c.id}`)).body.email, 'teste@example.com');
});
for (const key of ['cpf', 'rg', 'cnh'])
  test(`rejeita ${key.toUpperCase()} duplicado na criação e edição`, async () => {
    await client();
    const other = { cpf: '11144477735', rg: '98765X', cnh: '10987654321' };
    const duplicate = await api
      .post('/api/clients')
      .send({ ...clientData, ...other, [key]: clientData[key] })
      .expect(409);
    assert.equal(duplicate.body.error.code, `CLIENT_${key.toUpperCase()}_ALREADY_EXISTS`);
    const c = await client(other);
    await api
      .patch(`/api/clients/${c.id}`)
      .send({ [key]: clientData[key] })
      .expect(409);
  });
test('valida CPF, centavos inteiros, datas e IDs', async () => {
  await api.post('/api/clients').send({ name: 'Inválido', cpf: '11111111111' }).expect(400);
  const c = await client();
  const data = {
    company_id: 1,
    client_id: c.id,
    principal_amount: 10.5,
    installment_count: 1,
    loan_date: today(),
    first_due_date: today(),
  };
  await api.post('/api/loans').send(data).expect(400);
  await api
    .post('/api/loans')
    .send({ ...data, principal_amount: 100, first_due_date: '2026-02-30' })
    .expect(400);
  await api.get('/api/loans/abc').expect(400);
  await api.get('/api/loans/999').expect(404);
  await api.post('/api/clients').set('Content-Type', 'application/json').send('{').expect(400);
});
test('cria empréstimo com juros, parcelas diárias e soma exata', async () => {
  const l = await loan();
  assert.equal(l.total_amount, 11000);
  assert.equal(l.interest_amount, 1000);
  assert.deepEqual(
    l.installments.map((i) => i.amount),
    [3667, 3667, 3666],
  );
  assert.deepEqual(
    l.installments.map((i) => i.due_date),
    [today(), addDays(today(), 1), addDays(today(), 2)],
  );
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'ativo');
});
test('suporta parcelas personalizadas parciais e completas', async () => {
  let l = await loan({ installment_overrides: { 0: 5000 } });
  assert.deepEqual(
    l.installments.map((i) => i.amount),
    [5000, 3000, 3000],
  );
  l = (
    await api
      .patch(`/api/loans/${l.id}/installments`)
      .send({ revision: l.revision, installments: [4000, 4000, 3000] })
      .expect(200)
  ).body;
  assert.deepEqual(
    l.installments.map((i) => i.amount),
    [4000, 4000, 3000],
  );
  await api
    .post('/api/loans')
    .send({
      company_id: 1,
      client_id: l.client_id,
      principal_amount: 101,
      installment_count: 2,
      loan_date: today(),
      first_due_date: today(),
      installments: [50, 51],
    })
    .expect(201);
});
test('rejeita soma incorreta e personalização inválida sem criar contrato', async () => {
  const c = await client();
  const data = {
    company_id: 1,
    client_id: c.id,
    principal_amount: 100,
    installment_count: 2,
    loan_date: today(),
    first_due_date: today(),
  };
  for (const extra of [
    { installments: [40, 40] },
    { installment_overrides: { 2: 50 } },
    { installment_overrides: { 0: 100 } },
    { installments: [50, 50], installment_overrides: { 0: 60 } },
  ]) {
    await api
      .post('/api/loans')
      .send({ ...data, ...extra })
      .expect(400);
  }
  assert.equal((await database().prepare('SELECT COUNT(*) n FROM loans').get()).n, 0);
});
test('pagamento parcial, complementação e quitação atualizam todos os status', async () => {
  let l = await loan({ installment_count: 1 });
  l = await pay(l, 3000);
  assert.equal(l.installments[0].status, 'partial');
  assert.equal(l.status, 'active');
  l = await pay(l, 8000);
  assert.equal(l.installments[0].status, 'paid');
  assert.equal(l.status, 'paid');
  assert.equal(l.paid_amount, 11000);
  assert.equal(l.payments.length, 2);
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'quitado');
  await api
    .patch(`/api/loans/${l.id}/installments`)
    .send({ revision: l.revision, installments: [11000] })
    .expect(409);
});
test('parcela paga mantém multa independente pendente, parcial e quitada', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  l = await confirm(l, [select(1)]);
  const i = l.installments[0];
  assert.equal(i.status, 'paid');
  assert.equal(i.amount, 11000);
  assert.equal(i.late_fee_amount, 500);
  assert.equal(l.status, 'active');
  assert.equal(l.display_status, 'on-time');
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'ativo');
  let result = (
    await api
      .post(`/api/late-fees/${i.late_fee_id}/payments`)
      .send({ amount: 200, payment_date: today(), revision: l.revision })
      .expect(201)
  ).body;
  assert.equal(result.fee.status, 'partial');
  assert.equal(result.loan.installments[0].status, 'paid');
  result = (
    await api
      .post(`/api/late-fees/${i.late_fee_id}/payments`)
      .send({ amount: 300, payment_date: today(), revision: result.loan.revision })
      .expect(201)
  ).body;
  assert.equal(result.fee.status, 'paid');
  assert.equal(result.loan.status, 'paid');
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'quitado');
});
test('limiar de atenção centralizado: dois dias e acima', async () => {
  const l = await loan({
    installment_count: 1,
    first_due_date: addDays(today(), -env.ATTENTION_DAYS),
  });
  assert.equal(l.display_status, 'attention');
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'ativo');
  (await database()
    .prepare('UPDATE installments SET due_date=?')
    .run(addDays(today(), -env.ATTENTION_DAYS - 1)));
  assert.equal((await api.get(`/api/loans/${l.id}`)).body.display_status, 'overdue');
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'negativado');
});
test('confirmação complementa parcial e estorno preserva histórico', async () => {
  let l = await loan({ installment_count: 1 });
  l = await pay(l, 3000);
  l = await confirm(l, [select(1)]);
  assert.equal(l.paid_amount, 11000);
  assert.equal(l.payments.length, 2);
  l = await confirm(l, []);
  assert.equal(l.paid_amount, 0);
  assert.equal(l.payments.length, 2);
  assert.ok(l.payments.every((p) => p.voided_at));
  assert.equal(l.status, 'active');
  l = await confirm(l, [select(1)]);
  assert.equal(l.payments.length, 3);
  assert.equal(l.status, 'paid');
});
test('confirmação corrige data e multa sem destruir recebimentos', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -3) });
  l = await confirm(l, [select(1, 375)]);
  l = await confirm(l, [select(1, 125, addDays(today(), -2))]);
  assert.equal(l.payments.length, 2);
  assert.ok(l.payments[0].voided_at);
  assert.equal(l.installments[0].late_fee_amount, 125);
  assert.equal(l.status, 'paid');
});
test('duas telas não sobrescrevem pagamentos: revisão antiga retorna 409', async () => {
  const l = await loan();
  await confirm(l, [select(1)]);
  const before = (await snapshot());
  const error = await confirm(l, [], 409);
  assert.equal(error.error.code, 'STALE_LOAN');
  assert.deepEqual((await snapshot()), before);
});
test('valida excesso de pagamento, multa e cronologia', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  await api
    .post(`/api/installments/${l.installments[0].id}/payments`)
    .send({ amount: 11501, payment_date: today(), revision: l.revision })
    .expect(409);
  l = await pay(l, 1000);
  await api
    .post(`/api/installments/${l.installments[0].id}/payments`)
    .send({ amount: 10000, payment_date: addDays(today(), -1), revision: l.revision })
    .expect(409);
  await confirm(l, [select(1, 501)], 409);
  await confirm(l, [select(1, 0, addDays(today(), 1))], 400);
});
test('rollback integral quando a segunda parcela falha na confirmação', async () => {
  const l = await loan();
  const before = (await snapshot());
  await confirm(l, [select(1), select(2, 999)], 409);
  assert.deepEqual((await snapshot()), before);
});
test('rollback de empréstimo se INSERT de parcela falhar', async () => {
  const c = await client();
  (await injectFailure({"name":"fail_installment","event":"INSERT","table":"installments","condition":"NEW.installment_number=2"}));
  const before = (await snapshot());
  await api
    .post('/api/loans')
    .send({
      company_id: 1,
      client_id: c.id,
      principal_amount: 1000,
      installment_count: 2,
      loan_date: today(),
      first_due_date: today(),
    })
    .expect(409);
  assert.deepEqual((await snapshot()), before);
});
test('rollback de pagamento se atualização de status falhar', async () => {
  const l = await loan({ installment_count: 1 });
  (await injectFailure({"name":"fail_status","event":"UPDATE OF status","table":"loans","condition":"NEW.status='paid'"}));
  const before = (await snapshot());
  await api
    .post(`/api/installments/${l.installments[0].id}/payments`)
    .send({ amount: 11000, payment_date: today(), revision: l.revision })
    .expect(409);
  assert.deepEqual((await snapshot()), before);
});
test('cancelamento preserva contratos, bloqueia recebimento e histórico financeiro', async () => {
  const l = await loan();
  const cancelled = (
    await api
      .patch(`/api/loans/${l.id}`)
      .send({ revision: l.revision, status: 'cancelled' })
      .expect(200)
  ).body;
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'sem_contrato');
  await confirm(cancelled, [select(1)], 409);
  await api.delete(`/api/loans/${l.id}`).expect(404);
});
test('dashboard, relatório, pesquisa, paginação e notificações usam recebimentos reais', async () => {
  const l = await loan({ installment_count: 1 });
  await pay(l, 3000);
  const dash = (await api.get('/api/dashboard/summary').expect(200)).body;
  assert.equal(dash.received, 3000);
  assert.equal(dash.portfolio, 8000);
  const report = (
    await api
      .get('/api/reports')
      .query({ start: today(), end: today(), status: 'partial', search: 'teste', limit: 1 })
      .expect(200)
  ).body;
  assert.equal(report.summary.received, 3000);
  assert.equal(report.summary.pending, 8000);
  assert.equal(report.total, 1);
  assert.equal(report.chart[0].value, 3000);
  assert.equal(report.summary.partial, 1);
  assert.equal((await api.get('/api/notifications').expect(200)).body[0].amount, 3000);
  assert.equal((await api.get('/api/loans').query({ status: 'on-time', limit: 1 })).body.total, 1);
  await api
    .get('/api/reports')
    .query({ start: today(), end: addDays(today(), -1) })
    .expect(400);
});
test('rateio do lucro mantém centavos exatos', async () => {
  await loan();
  const report = (await api.get('/api/reports').query({ start: today(), end: addDays(today(), 2) }))
    .body;
  assert.equal(report.summary.expectedProfit, 1000);
});

test('resumo mensal separa juros, multas recebidas e lucro, respeitando período e estornos', async () => {
  const start = addDays(today(), -10);
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -2) });
  l = await pay(l, 3000, addDays(today(), -2));
  l = (await api.post(`/api/late-fees/${l.installments[0].late_fee_id}/payments`)
    .send({ amount: 75, payment_date: today(), revision: l.revision }).expect(201)).body.loan;
  const summary = async (from = start, end = today()) => (await api.get('/api/reports')
    .query({ mode: 'month', start: from, end }).expect(200)).body.summary;
  assert.deepEqual(await summary(), {
    capital: 10000, received: 3075, receivedLateFees: 75, realizedProfit: 348,
    pending: 8175, expectedInterest: 1000, expectedProfit: 1250,
  });
  // A multa recebida hoje pertence ao caixa de hoje, mesmo com vencimento anterior.
  assert.deepEqual(await summary(today()), {
    capital: 0, received: 75, receivedLateFees: 75, realizedProfit: 75,
    pending: 0, expectedInterest: 0, expectedProfit: 0,
  });
  l = await confirm(l, [select(1, 75)]);
  await confirm(l, []);
  assert.deepEqual(await summary(), {
    capital: 10000, received: 0, receivedLateFees: 0, realizedProfit: 0,
    pending: 11250, expectedInterest: 1000, expectedProfit: 1250,
  });
  assert.deepEqual(await summary(addDays(today(), 1), addDays(today(), 2)), {
    capital: 0, received: 0, receivedLateFees: 0, realizedProfit: 0,
    pending: 0, expectedInterest: 0, expectedProfit: 0,
  });
});

test('juros previstos mensais reutilizam o rateio exato das parcelas do período', async () => {
  await loan({ installments: [3333, 3333, 4334] });
  const summary = async (end) => (await api.get('/api/reports')
    .query({ mode: 'month', start: today(), end }).expect(200)).body.summary;
  assert.equal((await summary(today())).expectedInterest, 303);
  const all = await summary(addDays(today(), 2));
  assert.equal(all.expectedInterest, 1000);
  assert.equal(all.expectedProfit, 1000);
  assert.equal(all.receivedLateFees, 0);
});

test('indicadores por mês de contratação incluem parciais de outros meses e separam multas do saldo contratual', async () => {
  const origin = addDays(today(), -45);
  const period = { start: origin.slice(0, 7) + '-01' };
  period.end = addDays(addDays(period.start, 32).slice(0, 7) + '-01', -1);
  let l = await loan({ loan_date: origin, installment_count: 1, first_due_date: addDays(today(), -3) });
  const metrics = async (query = {}) => (await api.get('/api/reports')
    .query({ mode: 'metrics', ...period, ...query }).expect(200)).body;
  const empty = { capital: 0, interest: 0, receivedLateFees: 0, received: 0, pending: 0 };
  assert.deepEqual(await metrics(), { capital: 10000, interest: 1000, receivedLateFees: 0, received: 0, pending: 11000 });
  l = await pay(l, 3000, addDays(today(), -2));
  l = (await api.post(`/api/late-fees/${l.installments[0].late_fee_id}/payments`)
    .send({ amount: 75, payment_date: today(), revision: l.revision }).expect(201)).body.loan;
  assert.deepEqual(await metrics(), { capital: 10000, interest: 1000, receivedLateFees: 75, received: 3075, pending: 8000 });
  // A receipt this month does not bring a loan originated in another month into the cohort.
  assert.deepEqual(await metrics({ start: today().slice(0, 7) + '-01', end: today() }), empty);
  assert.deepEqual(await metrics({ company_id: 2 }), empty);
  assert.deepEqual(await metrics({ start: origin, end: origin }), await metrics());
  // Neither multiple receipts nor multiple installments may duplicate the loan's capital.
  l = await pay(l, 8000);
  assert.deepEqual(await metrics(), { capital: 10000, interest: 1000, receivedLateFees: 75, received: 11075, pending: 0 });
  await confirm(l, []);
  assert.deepEqual(await metrics(), { capital: 10000, interest: 1000, receivedLateFees: 0, received: 0, pending: 11000 });
  const cancelled = (await api.post('/api/loans').send({ company_id: 1, client_id: l.client_id,
    principal_amount: 20000, interest_percentage: '20', installment_count: 1,
    loan_date: origin, first_due_date: today() }).expect(201)).body;
  await api.patch(`/api/loans/${cancelled.id}`).send({ revision: cancelled.revision, status: 'cancelled' }).expect(200);
  assert.deepEqual(await metrics(), { capital: 10000, interest: 1000, receivedLateFees: 0, received: 0, pending: 11000 });
});

test('indicadores usam juros financeiros integrais mesmo com parcelas futuras e juros zero', async () => {
  const l = await loan({ loan_date: today(), first_due_date: addDays(today(), 30), installments: [3333, 3333, 4334] });
  const metrics = async () => (await api.get('/api/reports')
    .query({ mode: 'metrics', start: today(), end: today() }).expect(200)).body;
  assert.deepEqual(await metrics(), { capital: 10000, interest: 1000, receivedLateFees: 0, received: 0, pending: 11000 });
  await api.post('/api/loans').send({ company_id: 1, client_id: l.client_id, principal_amount: 12345,
    interest_percentage: '0', installment_count: 1, loan_date: today(), first_due_date: today() }).expect(201);
  assert.deepEqual(await metrics(), { capital: 22345, interest: 1000, receivedLateFees: 0, received: 0, pending: 23345 });
});

test('prévia congela multa na quitação e multa retroativa não excede saldo da data', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  const feeId = l.installments[0].late_fee_id;
  await api
    .post(`/api/late-fees/${feeId}/payments`)
    .send({ amount: 500, payment_date: addDays(today(), -2), revision: l.revision })
    .expect(409);
  l = await receipts(l, [{ amount: 11000, late_fee_received_amount: 250, payment_date: addDays(today(), -2) }]);
  const preview = (
    await api
      .post(`/api/installments/${l.installments[0].id}/payment-preview`)
      .send({ payment_date: today() })
      .expect(200)
  ).body;
  assert.equal(preview.late_fee_amount, 250);
});

test('status manual é preservado e mudanças incompatíveis fazem rollback', async () => {
  const l = await loan();
  await api.patch(`/api/clients/${l.client_id}`).send({ status: 'negativado' }).expect(200);
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'negativado');
  await api
    .patch(`/api/clients/${l.client_id}`)
    .send({ status: 'quitado', name: 'Não salvar' })
    .expect(409);
  const c = (await api.get(`/api/clients/${l.client_id}`)).body;
  assert.equal(c.name, clientData.name);
  assert.equal(c.status, 'negativado');
  await api.patch(`/api/clients/${l.client_id}`).send({ status: 'ativo' }).expect(200);
});

test('recebimentos estornados não entram no dashboard, mas continuam bloqueando cancelamento', async () => {
  let l = await loan({ installment_count: 1 });
  l = await confirm(l, [select(1)]);
  l = await confirm(l, []);
  assert.equal((await api.get('/api/dashboard/summary')).body.received, 0);
  await api
    .patch(`/api/loans/${l.id}`)
    .send({ revision: l.revision, status: 'cancelled' })
    .expect(409);
});
test('seed é atômico, idempotente e inclui todos os cenários', async () => {
  assert.equal((await seedDevelopment()), 6);
  const before = (await snapshot());
  assert.equal((await seedDevelopment()), 0);
  assert.deepEqual((await snapshot()), before);
  assert.ok(before[1].some((l) => l.status === 'paid'));
  assert.ok(before[2].some((i) => i.status === 'partial'));
  assert.ok(before[4].some((f) => f.amount > f.paid_amount));
});


test('edição recalcula contrato com as regras do cadastro e preserva IDs das parcelas restantes', async () => {
  let l = await loan({ first_due_date:addDays(today(), -2) });
  const ids = l.installments.map(i => i.id);
  l = (await api.patch('/api/loans/'+l.id).send({revision:l.revision,
    principal_amount:20001, interest_percentage:'12.35', installment_count:4,
    late_fee_per_day:250, loan_date:today(), first_due_date:addDays(today(), 1), notes:'Atualizado',
  }).expect(200)).body;
  assert.equal(l.interest_amount,2470);
  assert.equal(l.total_amount,22471);
  assert.deepEqual(l.installments.map(i=>i.amount),[5618,5618,5618,5617]);
  assert.deepEqual(l.installments.slice(0,3).map(i=>i.id),ids);
  assert.equal(l.installments[3].due_date,addDays(today(),4));
  assert.equal(l.fee_remaining,0);
  assert.equal(l.notes,'Atualizado');
  assert.equal(l.revision,1);
  l = (await api.patch('/api/loans/'+l.id).send({revision:l.revision,
    installment_count:2,installment_overrides:{0:10000},late_fee_per_day:0,
  }).expect(200)).body;
  assert.deepEqual(l.installments.map(i=>i.amount),[10000,12471]);
  assert.deepEqual(l.installments.map(i=>i.id),ids.slice(0,2));
  assert.equal(l.late_fee_per_day,0);
  assert.equal(Number(l.interest_percentage),12.35);
});

test('troca de cliente mantém condições, parcelas personalizadas e atualiza ambos os clientes', async () => {
  const l = await loan({installments:[5000,3000,3000]});
  const other = await client({name:'Novo cliente',cpf:'11144477735',rg:null,cnh:null});
  const updated = (await api.patch('/api/loans/'+l.id).send({revision:l.revision,client_id:other.id}).expect(200)).body;
  assert.equal(updated.client_id,other.id);
  assert.equal(updated.client_name,other.name);
  assert.equal(updated.created_by,l.created_by);
  assert.deepEqual(updated.installments.map(i=>[i.id,i.amount,i.due_date]),l.installments.map(i=>[i.id,i.amount,i.due_date]));
  assert.equal((await api.get('/api/clients/'+l.client_id)).body.status,'sem_contrato');
  assert.equal((await api.get('/api/clients/'+other.id)).body.status,'ativo');
});

test('edição valida campos, cronologia, soma, limite e revisão sem mutações parciais', async () => {
  const l = await loan();
  for (const data of [{principal_amount:0},{principal_amount:1.5},{interest_percentage:'1.234'},
    {installment_count:121},{late_fee_per_day:-1},{first_due_date:'2026-02-30'},
    {loan_date:addDays(today(),1)},{installments:[1,1,1]},
    {installment_overrides:{3:100}},{installments:[3667,3667,3666],installment_overrides:{0:1}},
    {principal_amount:100000000000,interest_percentage:'1'},{created_by:123}]) {
    const before = await snapshot();
    await api.patch('/api/loans/'+l.id).send({revision:l.revision,...data}).expect(400);
    assert.deepEqual(await snapshot(),before);
  }
  await api.patch('/api/loans/'+l.id).send({revision:l.revision,client_id:99999}).expect(404);
  await api.patch('/api/loans/'+l.id).send({revision:l.revision,principal_amount:20000}).expect(200);
  const before = await snapshot();
  const stale = await api.patch('/api/loans/'+l.id).send({revision:l.revision,notes:'Obsoleto'}).expect(409);
  assert.equal(stale.body.error.code,'STALE_LOAN');
  assert.deepEqual(await snapshot(),before);
});

for (const state of ['partial','paid','fee','voided','cancelled']) {
  test('edição aceita condições compatíveis e preserva histórico: '+state, async () => {
    let l = await loan({installment_count:1,first_due_date:addDays(today(),-2)});
    if (state==='cancelled') l=(await api.patch('/api/loans/'+l.id).send({revision:l.revision,status:'cancelled'}).expect(200)).body;
    else if (state==='fee') l=(await api.post('/api/late-fees/'+l.installments[0].late_fee_id+'/payments')
      .send({revision:l.revision,amount:100,payment_date:today()}).expect(201)).body.loan;
    else l=await pay(l,state==='partial'?1000:11000);
    if (state==='voided') l=await confirm(l,[]);
    const history = l.payments;
    const installmentId = l.installments[0].id;
    l = (await api.patch('/api/loans/'+l.id).send({revision:l.revision,
      principal_amount:30000,interest_percentage:'20',installment_count:2,
      late_fee_per_day:150,loan_date:addDays(today(),-11),first_due_date:addDays(today(),-3),
      installments:[20000,16000],
    }).expect(200)).body;
    assert.deepEqual(l.payments,history);
    assert.equal(l.installments[0].id,installmentId);
    assert.deepEqual(l.installments.map(i=>i.amount),[20000,16000]);
    assert.equal(l.total_amount,36000);
    assert.equal(l.interest_amount,6000);
    assert.equal(l.status === 'cancelled',state === 'cancelled');
    const other=await client({cpf:'11144477735',rg:null,cnh:null});
    const saved=(await api.patch('/api/loans/'+l.id).send({revision:l.revision,client_id:other.id,
      principal_amount:l.principal_amount,interest_percentage:l.interest_percentage,installment_count:l.installment_count,
      late_fee_per_day:l.late_fee_per_day,loan_date:l.loan_date,first_due_date:l.first_due_date,
      installments:l.installments.map(i=>i.amount),notes:'Correção cadastral',
    }).expect(200)).body;
    assert.deepEqual(saved.payments,l.payments);
    assert.deepEqual(saved.installments.map(({updated_at:_updatedAt,...i})=>i),l.installments.map(({updated_at:_updatedAt,...i})=>i));
    assert.equal(saved.paid_amount,l.paid_amount);
    assert.equal(saved.fee_remaining,l.fee_remaining);
    assert.equal(saved.total_amount,l.total_amount);
  });
}

async function receipts(l, entries = [], voidIds = [], status = 200) {
  return (await api.put(`/api/loans/${l.id}/payment-confirmation`).send({
    revision: l.revision, receipts: entries.map(entry => ({ installment_number: 1, payment_date: today(), ...entry })),
    void_payment_ids: voidIds,
  }).expect(status)).body;
}

async function waive(l, ids = [l.installments[0].id], status = 200, extra = {}) {
  return (await api.put(`/api/loans/${l.id}/payment-confirmation`).send({
    revision: l.revision, receipts: [], waive_installment_ids: ids, ...extra,
  }).expect(status)).body;
}

test('valor recebido integral quita a parcela e registra a divisão e o autor na auditoria', async () => {
  let l = await loan({ installment_count: 1 });
  l = await pay(l, 11000);
  assert.equal(l.installments[0].status, 'paid');
  assert.equal(l.installments[0].paid_at, today());
  assert.equal(l.payments[0].amount, 11000);
  assert.equal(l.payments[0].late_fee_amount, 0);
  const audit = await database().prepare("SELECT * FROM auth_audit_logs WHERE event='payment_created'").get();
  const details = JSON.parse(audit.details);
  assert.equal(audit.actor_id, l.payments[0].created_by);
  assert.equal(details.amount, 11000);
  assert.equal(details.installment_amount, 11000);
  assert.equal(details.late_fee_amount, 0);
  assert.equal(details.remaining_amount, 0);
});

test('R$ 90 recebidos de R$ 110 deixam R$ 20 em aberto e relatório parcial', async () => {
  let l = await loan({ installment_count: 1 });
  l = await receipts(l, [{ amount: 9000 }]);
  const i = l.installments[0];
  assert.equal(i.amount - i.paid_amount, 2000);
  assert.equal(i.status, 'partial');
  assert.equal(i.paid_at, null);
  assert.equal(l.status, 'active');
  assert.equal(l.paid_installments, 0);
  const report = (await api.get('/api/reports').query({ start: today(), end: today() }).expect(200)).body;
  assert.equal(report.summary.received, 9000);
  assert.equal(report.summary.pending, 2000);
  assert.equal(report.summary.paid, 0);
  assert.equal(report.summary.partial, 1);
});

test('somente multa mantém R$ 110 da parcela e multa paga não volta a ser cobrada', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -2), late_fee_per_day: 1000 });
  l = (await api.post(`/api/installments/${l.installments[0].id}/payments`).send({
    revision: l.revision, amount: 2000, payment_date: today(), fee_only: true,
  }).expect(201)).body.loan;
  assert.equal(l.installments[0].paid_amount, 0);
  assert.equal(l.installments[0].late_fee_paid_amount, 2000);
  assert.equal(l.installments[0].status, 'partial');
  assert.equal(l.installments[0].paid_at, null);
  assert.equal(l.status, 'active');
  for (let n = 0; n < 2; n++) {
    l = (await api.get(`/api/loans/${l.id}`).expect(200)).body;
    assert.equal(l.installments[0].late_fee_amount - l.installments[0].late_fee_paid_amount, 0);
  }
  const preview = (await api.post(`/api/installments/${l.installments[0].id}/payment-preview`)
    .send({ payment_date: today() }).expect(200)).body;
  assert.equal(preview.late_fee_remaining, 0);
  assert.equal(preview.remaining_amount, 11000);
  l = await receipts(l, [{ amount: 3000 }]);
  assert.equal(l.payments.at(-1).late_fee_amount, 0);
  assert.equal(l.payments.at(-1).amount, 3000);
  assert.equal(l.installments[0].amount - l.installments[0].paid_amount, 8000);
});

test('R$ 50 abatem apenas a parcela mesmo com multa pendente; caixa e lucro usam a divisão', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -2), late_fee_per_day: 1000 });
  l = await receipts(l, [{ amount: 5000 }]);
  assert.equal(l.payments[0].amount, 5000);
  assert.equal(l.payments[0].late_fee_amount, 0);
  assert.equal(l.installments[0].amount - l.installments[0].paid_amount, 6000);
  assert.equal(l.installments[0].status, 'partial');
  const report = (await api.get('/api/reports').query({ mode: 'month', start: addDays(today(), -10), end: today() }).expect(200)).body;
  assert.equal(report.summary.received, 5000);
  assert.equal(report.summary.receivedLateFees, 0);
  assert.equal(report.summary.realizedProfit, 455);
  assert.equal(report.summary.pending, 8000);
  const audit = await database().prepare("SELECT details FROM auth_audit_logs WHERE event='payment_created'").get();
  assert.equal(JSON.parse(audit.details).remaining_amount, 6000);
});

for (const [option, fee] of [['Sim', 2000], ['Não', 0], ['Outro valor', 500]]) {
  test(`quitação da parcela com multa ${option} soma somente valores recebidos`, async () => {
    let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -2), late_fee_per_day: 1000 });
    l = await receipts(l, [{ amount: 11000, late_fee_received_amount: fee }]);
    assert.equal(l.installments[0].status, 'paid');
    assert.equal(l.installments[0].paid_at, today());
    assert.equal(l.installments[0].paid_amount, 11000);
    assert.equal(l.installments[0].late_fee_paid_amount, fee);
    assert.equal(l.installments[0].late_fee_amount - l.installments[0].late_fee_paid_amount, 2000 - fee);
    assert.equal(l.payments[0].amount + l.payments[0].late_fee_amount, 11000 + fee);
    const report = (await api.get('/api/reports').query({ mode: 'month', start: addDays(today(), -10), end: today() }).expect(200)).body;
    assert.equal(report.summary.received, 11000 + fee);
    assert.equal(report.summary.receivedLateFees, fee);
    l = await receipts(l, [], [l.payments[0].id]);
    assert.equal(l.installments[0].paid_amount, 0);
    assert.equal(l.installments[0].late_fee_paid_amount, 0);
    assert.equal(l.installments[0].paid_at, null);
  });
}

test('multa de R$ 80 recebe R$ 30 e R$ 20; quitação cobra apenas os R$ 30 restantes', async () => {
  let l = await loan({ principal_amount: 6000, interest_percentage: '0', installment_count: 1,
    first_due_date: addDays(today(), -4), late_fee_per_day: 2000 });
  l = await receipts(l, [{ amount: 3000, fee_only: true }, { amount: 2000, fee_only: true }]);
  assert.equal(l.installments[0].paid_amount, 0);
  assert.equal(l.installments[0].late_fee_paid_amount, 5000);
  assert.equal(l.installments[0].late_fee_amount - l.installments[0].late_fee_paid_amount, 3000);
  assert.notEqual(l.installments[0].status, 'paid');
  assert.equal(l.payments.reduce((sum, p) => sum + p.amount + p.late_fee_amount, 0), 5000);
  await receipts(l, [{ amount: 3001, fee_only: true }], [], 409);
  await receipts(l, [{ amount: 6000, late_fee_received_amount: 8000 }], [], 409);
  l = await receipts(l, [{ amount: 6000, late_fee_received_amount: 3000 }]);
  assert.equal(l.installments[0].status, 'paid');
  assert.equal(l.installments[0].late_fee_paid_amount, 8000);
  assert.equal(l.payments.reduce((sum, p) => sum + p.amount + p.late_fee_amount, 0), 14000);
  const preview = (await api.post(`/api/installments/${l.installments[0].id}/payment-preview`)
    .send({ payment_date: today() }).expect(200)).body;
  assert.equal(preview.late_fee_remaining, 0);
});

test('múltiplos parciais só quitam ao receber o último centavo', async () => {
  let l = await loan({ installment_count: 1 });
  for (const amount of [3000, 4000, 3999]) {
    l = await receipts(l, [{ amount }]);
    assert.equal(l.installments[0].status, 'partial');
    assert.equal(l.installments[0].paid_at, null);
    assert.equal(l.paid_installments, 0);
  }
  l = await receipts(l, [{ amount: 1 }]);
  assert.equal(l.installments[0].paid_amount, 11000);
  assert.equal(l.installments[0].status, 'paid');
  assert.equal(l.paid_installments, 1);
  assert.equal(l.status, 'paid');
});

test('multa parcial e dias adicionais descontam apenas multa ainda não recebida', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -3), late_fee_per_day: 1000 });
  l = await receipts(l, [{ amount: 1000, fee_only: true, payment_date: addDays(today(), -1) }]);
  assert.equal(l.installments[0].late_fee_amount - l.installments[0].late_fee_paid_amount, 2000);
  l = await receipts(l, [{ amount: 2500 }]);
  assert.equal(l.payments.at(-1).late_fee_amount, 0);
  assert.equal(l.payments.at(-1).amount, 2500);
  assert.equal(l.installments[0].late_fee_paid_amount, 1000);
  assert.equal(l.installments[0].paid_amount, 2500);
  l = await receipts(l, [{ amount: 2000, fee_only: true }]);
  assert.equal(l.installments[0].late_fee_paid_amount, 3000);
  assert.equal(l.installments[0].paid_amount, 2500);
});

for (const feeOnly of [false, true]) {
  test(`estorno individual restaura saldos e auditoria sem remover outros pagamentos: somente multa=${feeOnly}`, async () => {
    let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -2), late_fee_per_day: 1000 });
    l = await receipts(l, [{ amount: feeOnly ? 2000 : 5000, fee_only: feeOnly }]);
    const first = l.payments[0];
    l = await receipts(l, [{ amount: 1000 }]);
    l = await receipts(l, [], [first.id]);
    assert.ok(l.payments[0].voided_at);
    assert.equal(l.payments[1].voided_at, null);
    assert.equal(l.installments[0].paid_amount, 1000);
    assert.equal(l.installments[0].late_fee_paid_amount, 0);
    assert.equal(l.installments[0].late_fee_amount, 2000);
    assert.equal(l.installments[0].status, 'partial');
    const audit = await database().prepare("SELECT * FROM auth_audit_logs WHERE event='payment_voided'").get();
    assert.equal(audit.actor_id, first.created_by);
    const details = JSON.parse(audit.details);
    assert.equal(details.amount, first.amount + first.late_fee_amount);
    assert.equal(details.installment_amount, first.amount);
    assert.equal(details.late_fee_amount, feeOnly ? 2000 : 0);
    assert.equal(details.remaining_amount, 10000);
    const report = (await api.get('/api/reports').query({ mode: 'month', start: addDays(today(), -10), end: today() }).expect(200)).body;
    assert.equal(report.summary.received, 1000);
    assert.equal(report.summary.receivedLateFees, 0);
    assert.equal(report.summary.pending, 12000);
    await receipts(l, [], [first.id], 409);
  });
}

test('estorno da última complementação reabre uma parcela quitada', async () => {
  let l = await loan({ installment_count: 1 });
  l = await receipts(l, [{ amount: 9000 }, { amount: 2000 }]);
  assert.equal(l.status, 'paid');
  l = await receipts(l, [], [l.payments.at(-1).id]);
  assert.equal(l.installments[0].status, 'partial');
  assert.equal(l.installments[0].paid_amount, 9000);
  assert.equal(l.installments[0].paid_at, null);
  assert.equal(l.status, 'active');
});

test('valida centavos, excesso, cronologia, revisão e isolamento no novo fluxo', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -2), late_fee_per_day: 1000 });
  for (const amount of [0, -1, 0.5, 100000000001, '100'])
    await receipts(l, [{ amount }], [], 400);
  await receipts(l, [{ amount: 2001, fee_only: true }], [], 409);
  await receipts(l, [{ amount: 11001 }], [], 409);
  await receipts(l, [{ amount: 11000, late_fee_received_amount: 2001 }], [], 409);
  await receipts(l, [{ amount: 100, late_fee_received_amount: 100 }], [], 409);
  await receipts(l, [{ amount: 100, fee_only: true, late_fee_received_amount: 100 }], [], 409);
  for (const fee of [-1, 0.5, '100'])
    await receipts(l, [{ amount: 11000, late_fee_received_amount: fee }], [], 400);
  await receipts(l, [{ amount: 13001 }], [], 409);
  await receipts(l, [{ amount: 1, installment_number: 2 }], [], 404);
  await receipts(l, [], [999999], 404);
  await receipts(l, [{ amount: 1, created_by: 1 }], [], 400);
  const stale = l;
  l = await receipts(l, [{ amount: 1000 }]);
  await receipts(stale, [{ amount: 1000 }], [], 409);
  await receipts(l, [{ amount: 1, payment_date: addDays(today(), -1) }], [], 409);
  const before = await snapshot();
  await receipts(l, [{ amount: 999999 }], [l.payments[0].id], 409);
  assert.deepEqual(await snapshot(), before);
  const other = (await api.post('/api/loans').send({ company_id: 2, client_id: l.client_id,
    principal_amount: 10000, installment_count: 1, loan_date: today(), first_due_date: today() }).expect(201)).body;
  await receipts(other, [], [l.payments[0].id], 404);
});

test('multa dispensada e pagamentos antigos preservam seus valores', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -2), late_fee_per_day: 1000 });
  l = await receipts(l, [{ amount: 9000 }]);
  l = await waive(l);
  assert.equal(l.payments[0].amount, 9000);
  assert.equal(l.payments[0].late_fee_amount, 0);
  const old = l.payments[0];
  l = await receipts(l, [{ amount: 2000 }]);
  assert.equal(l.status, 'paid');
  assert.deepEqual(l.payments[0], old);
});

test('pagamento registrado durante edição impede salvar revisão antiga',async()=>{
  const l=await loan();
  await pay(l,100);
  const before=await snapshot();
  const error=await api.patch('/api/loans/'+l.id).send({revision:l.revision,principal_amount:20000}).expect(409);
  assert.equal(error.body.error.code,'STALE_LOAN');
  assert.deepEqual(await snapshot(),before);
});

for(const failure of [{name:'fail_edit_installment',event:'INSERT',table:'installments',condition:'NEW.installment_number=4'},
  {name:'fail_edit_audit',event:'INSERT',table:'auth_audit_logs',condition:"NEW.event='loan_updated'"}]) {
  test('edição faz rollback integral em falha: '+failure.name, async()=>{
    const l=await loan();
    await injectFailure(failure);
    const before=await snapshot();
    const audit=await database().prepare('SELECT * FROM auth_audit_logs').all();
    await api.patch('/api/loans/'+l.id).send({revision:l.revision,principal_amount:20000,installment_count:4}).expect(409);
    assert.deepEqual(await snapshot(),before);
    assert.deepEqual(await database().prepare('SELECT * FROM auth_audit_logs').all(),audit);
  });
}


test('pagamento parcial bloqueia redistribuição abaixo do recebido mesmo preservando a soma total',async()=>{
  let l=await loan();
  l=await pay(l,1000);
  const before=await snapshot();
  const error=await api.patch('/api/loans/'+l.id).send({revision:l.revision,installments:[500,5500,5000]}).expect(409);
  assert.equal(error.body.error.code,'PAYMENT_EXCEEDS_BALANCE');
  assert.deepEqual(await snapshot(),before);
});

test('edição rejeita datas e multas incompatíveis com recebimentos, sem alterações parciais', async () => {
  let l = await loan({ installment_count:1, first_due_date:addDays(today(),-4) });
  l = await pay(l, 1000, addDays(today(),-4));
  l = (await api.post('/api/late-fees/'+l.installments[0].late_fee_id+'/payments')
    .send({revision:l.revision,amount:200,payment_date:addDays(today(),-2)}).expect(201)).body.loan;
  for (const [data, status, code] of [
    [{loan_date:addDays(today(),-1),first_due_date:today()},400,'INVALID_PAYMENT_DATE'],
    [{late_fee_per_day:0},409,'FEE_PAYMENT_EXCEEDS_BALANCE'],
    [{late_fee_per_day:75},409,'FEE_PAYMENT_EXCEEDS_BALANCE'],
    [{first_due_date:addDays(today(),-1)},409,'FEE_PAYMENT_EXCEEDS_BALANCE'],
  ]) {
    const before = await snapshot();
    const result = await api.patch('/api/loans/'+l.id).send({revision:l.revision,...data}).expect(status);
    assert.equal(result.body.error.code,code);
    assert.deepEqual(await snapshot(),before);
  }
});

for (const voided of [false,true]) {
  test('redução de parcelas preserva histórico, inclusive estornado: '+voided, async () => {
    let l = await loan();
    l = await confirm(l,[select(3)]);
    if (voided) l = await confirm(l,[]);
    const before = await snapshot();
    const result = await api.patch('/api/loans/'+l.id).send({revision:l.revision,installment_count:2}).expect(409);
    assert.equal(result.body.error.code,'INSTALLMENT_HAS_PAYMENTS');
    assert.deepEqual(await snapshot(),before);
  });
}

test('redução remove somente parcelas sem histórico e mantém quitação e saldos exatos', async () => {
  let l = await loan();
  l = await pay(l,1000);
  const history = l.payments;
  l = (await api.patch('/api/loans/'+l.id).send({revision:l.revision,installment_count:2,
    installments:[1000,10000]}).expect(200)).body;
  assert.equal(l.installments[0].status,'paid');
  assert.deepEqual(l.payments,history);
  assert.equal(l.installments.length,2);
  assert.equal((await api.get('/api/dashboard/summary')).body.portfolio,10000);
});

for (const [label, receipt, principalPaid] of [
  ['parcela parcial', { amount: 1 }, false],
  ['parcela integral', { amount: 11000 }, true],
  ['multa parcial', { amount: 1, fee_only: true }, false],
  ['multa integral', { amount: 1000, fee_only: true }, false],
]) test(`recebimento de ${label} impede atraso automático indefinidamente sem apagar dias e multa`, async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -8) });
  assert.equal(l.display_status, 'overdue');
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'negativado');
  l = await receipts(l, [receipt]);
  assert.equal(l.display_status, 'on-time');
  assert.equal(l.status, 'active');
  assert.equal(l.installments[0].has_receipt, 1);
  assert.equal(l.installments[0].days_late, 8);
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'ativo');
  for (const status of ['attention', 'overdue'])
    assert.equal((await api.get('/api/loans').query({ status })).body.total, 0);
  const dashboard = (await api.get('/api/dashboard/summary')).body;
  assert.deepEqual(dashboard.portfolio_status, { total: 1, regular: 1, attention: 0, overdue: 0 });
  const notices = (await api.get('/api/notifications')).body;
  assert.equal(notices.filter(item => item.type === 'overdue').length, 0);
  const monthly = (await api.get('/api/reports').query({ mode: 'month', start: addDays(today(), -10), end: today() })).body;
  assert.equal(monthly.contractStatuses[0].status, 'on-time');
  assert.equal(monthly.agenda[0].late, 0);
  // Refresh with a distant date without rewriting or manufacturing a receipt.
  await refreshFinancialState(l.id, addDays(today(), 3650));
  const fee = await database().prepare('SELECT * FROM late_fees WHERE installment_id=?').get(l.installments[0].id);
  assert.equal(fee.days_late, principalPaid ? 8 : 3658);
  assert.equal(fee.amount, fee.days_late * 125);
  assert.equal((await database().prepare('SELECT status FROM clients WHERE id=?').get(l.client_id)).status, 'ativo');
  assert.equal((await database().prepare('SELECT status FROM loans WHERE id=?').get(l.id)).status, 'active');
});

test('abono individual preserva multa original, recebimentos, caixa e auditoria separada', async () => {
  let l = await loan({ installment_count: 2, first_due_date: addDays(today(), -10), late_fee_per_day: 1000 });
  l = await receipts(l, [{ amount: 3000, fee_only: true }]);
  const originalPayments = l.payments;
  const other = l.installments[1];
  const stale = l;
  l = await waive(l);
  const i = l.installments[0];
  assert.equal(i.late_fee_amount, 10000);
  assert.equal(i.late_fee_paid_amount, 3000);
  assert.equal(i.late_fee_waived_amount, 7000);
  assert.equal(i.late_fee_remaining, 0);
  assert.equal(i.paid_amount, 0);
  assert.equal(i.late_fee_status, 'waived');
  assert.deepEqual(l.payments, originalPayments);
  for (const key of ['id', 'amount', 'paid_amount', 'due_date', 'status', 'late_fee_amount', 'late_fee_paid_amount', 'late_fee_waived_amount'])
    assert.equal(l.installments[1][key], other[key]);
  // The other unpaid installment still determines delinquency.
  assert.equal(l.display_status, 'overdue');
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'negativado');
  assert.equal(l.fee_waivers.length, 1);
  assert.equal(l.fee_waivers[0].installment_id, i.id);
  assert.equal(l.fee_waivers[0].waived_amount, 7000);
  assert.equal(l.fee_waivers[0].actor_id, originalPayments[0].created_by);
  assert.equal(l.fee_waivers[0].actor_name, 'Test Master');
  assert.ok(l.fee_waivers[0].created_at > 0);
  assert.equal((await waive(stale, [i.id], 409)).error.code, 'STALE_LOAN');
  assert.equal((await waive(l, [i.id], 409)).error.code, 'NO_PENDING_FEE');
  const report = (await api.get('/api/reports').query({ start: addDays(today(), -10), end: today() })).body;
  assert.equal(report.summary.received, 3000);
  assert.equal(report.summary.pending, 20000);
  assert.equal(report.items.find(item => item.id === i.id).lateFeeWaived, 7000);
  assert.equal((await api.get('/api/dashboard/summary')).body.received, 3000);
  const monthly = (await api.get('/api/reports').query({ mode: 'month', start: addDays(today(), -10), end: today() })).body;
  assert.equal(monthly.summary.receivedLateFees, 3000);
  assert.equal(monthly.summary.realizedProfit, 3000);
  assert.equal(monthly.summary.expectedProfit, 13000);
  l = (await api.get(`/api/loans/${l.id}`)).body;
  assert.equal(l.installments[0].late_fee_waived_amount, 7000);
  await refreshFinancialState(l.id, addDays(today(), 3));
  const grown = await database().prepare('SELECT * FROM late_fees WHERE installment_id=?').get(i.id);
  assert.equal(grown.amount, 13000);
  assert.equal(grown.waived_amount, 7000);
  assert.equal(grown.paid_amount, 3000);
  assert.equal(grown.amount - grown.waived_amount - grown.paid_amount, 3000);
});

for (const receipt of [{ amount: 100 }, { amount: 11000 }, { amount: 1, fee_only: true }])
  test(`abono aceita recebimento de parcela ou multa: ${JSON.stringify(receipt)}`, async () => {
    let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
    l = await receipts(l, [receipt]);
    const before = l.payments;
    l = await waive(l);
    assert.equal(l.installments[0].late_fee_remaining, 0);
    assert.equal(l.installments[0].late_fee_waived_amount, 500 - (receipt.fee_only ? 1 : 0));
    assert.deepEqual(l.payments, before);
    assert.equal(l.status, receipt.amount === 11000 ? 'paid' : 'active');
    assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, receipt.amount === 11000 ? 'quitado' : 'ativo');
  });

test('abono rejeita parcela sem recebimento, outra parcela, duplicação e recebimento estornado', async () => {
  let l = await loan({ installment_count: 2, first_due_date: addDays(today(), -5) });
  assert.equal((await waive(l, undefined, 409)).error.code, 'WAIVER_REQUIRES_RECEIPT');
  l = await receipts(l, [{ amount: 100 }]);
  assert.equal((await waive(l, [l.installments[1].id], 409)).error.code, 'WAIVER_REQUIRES_RECEIPT');
  await waive(l, [l.installments[0].id, l.installments[0].id], 400);
  const another = (await api.post('/api/loans').send({ company_id: 2, client_id: l.client_id,
    principal_amount: 100, installment_count: 1, loan_date: today(), first_due_date: today() }).expect(201)).body;
  await waive(l, [another.installments[0].id], 404);
  const before = await snapshot();
  await waive(l, undefined, 409, { void_payment_ids: [l.payments[0].id] });
  assert.deepEqual(await snapshot(), before);
  l = await receipts(l, [], [l.payments[0].id]);
  assert.equal((await waive(l, undefined, 409)).error.code, 'WAIVER_REQUIRES_RECEIPT');
});

test('abono e auditoria fazem rollback integral se outra parcela ou auditoria falhar', async () => {
  let l = await loan({ installment_count: 2, first_due_date: addDays(today(), -5) });
  l = await receipts(l, [{ amount: 100 }]);
  const before = await snapshot();
  const audit = await database().prepare('SELECT * FROM auth_audit_logs').all();
  await waive(l, l.installments.map(item => item.id), 409);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await database().prepare('SELECT * FROM auth_audit_logs').all(), audit);
  await injectFailure({ name: 'fail_waiver_audit', event: 'INSERT', table: 'auth_audit_logs', condition: "NEW.event='late_fee_waived'" });
  await waive(l, undefined, 409);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await database().prepare('SELECT * FROM auth_audit_logs').all(), audit);
});

test('recebimento não desfaz negativação manual e estorno explícito permite reclassificação', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -5) });
  await api.patch(`/api/clients/${l.client_id}`).send({ status: 'negativado' }).expect(200);
  l = await receipts(l, [{ amount: 100 }]);
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'negativado');
  l = await receipts(l, [], [l.payments[0].id]);
  assert.equal(l.display_status, 'overdue');
  assert.equal(l.installments[0].has_receipt, 0);
});

test('abono é descontado das prévias e de todos os caminhos de recebimento sem dupla cobrança', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  l = await receipts(l, [{ amount: 100, fee_only: true }]);
  l = await waive(l);
  const i = l.installments[0];
  const preview = (await api.post(`/api/installments/${i.id}/payment-preview`).send({ payment_date: today() }).expect(200)).body;
  assert.equal(preview.late_fee_amount, 500);
  assert.equal(preview.late_fee_remaining, 0);
  await receipts(l, [{ amount: 1, fee_only: true }], [], 409);
  await api.post(`/api/late-fees/${i.late_fee_id}/payments`).send({ amount: 1, revision: l.revision, payment_date: today() }).expect(409);
  await confirm(l, [select(1, 101)], 409);
  await api.patch(`/api/loans/${l.id}`).send({ revision: l.revision, late_fee_per_day: 1 }).expect(409);
  l = await receipts(l, [{ amount: 11000 }]);
  assert.equal(l.status, 'paid');
  assert.equal(l.installments[0].late_fee_amount, 500);
  assert.equal(l.installments[0].late_fee_paid_amount, 100);
  assert.equal(l.installments[0].late_fee_waived_amount, 400);
  await refreshFinancialState(l.id, addDays(today(), 365));
  const frozen = await database().prepare('SELECT * FROM late_fees WHERE id=?').get(i.late_fee_id);
  assert.equal(frozen.amount, 500);
  assert.equal(frozen.days_late, 4);
});

test('novas multas após abono aceitam novo abono e recebimento sem voltar à negativação', async t => {
  const { getLoan } = await import('../src/modules/loans/loans.service.js');
  const { confirmPayments } = await import('../src/modules/payments/payments.service.js');
  const { payFee } = await import('../src/modules/late-fees/late-fees.service.js');
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  l = await receipts(l, [{ amount: 125, fee_only: true }]);
  l = await waive(l);
  const actor = await database().prepare('SELECT * FROM users WHERE id=?').get(l.payments[0].created_by);
  const nextDay = Date.now() + 86400000;
  t.mock.timers.enable({ apis: ['Date'], now: nextDay });
  l = await getLoan(l.id);
  assert.equal(l.installments[0].late_fee_remaining, 125);
  assert.equal(l.display_status, 'on-time');
  l = await confirmPayments(l.id, { revision: l.revision, receipts: [], waive_installment_ids: [l.installments[0].id] }, actor);
  assert.equal(l.installments[0].late_fee_waived_amount, 500);
  assert.equal(l.fee_waivers.length, 2);
  assert.equal(l.fee_waivers[1].waived_amount, 125);
  assert.equal(l.payments.length, 1);
  t.mock.timers.setTime(nextDay + 86400000);
  l = await getLoan(l.id);
  l = (await payFee(l.installments[0].late_fee_id, { revision: l.revision, amount: 125, payment_date: today() }, actor)).loan;
  assert.equal(l.installments[0].late_fee_amount, 750);
  assert.equal(l.installments[0].late_fee_paid_amount, 250);
  assert.equal(l.installments[0].late_fee_waived_amount, 500);
  assert.equal(l.installments[0].late_fee_remaining, 0);
  assert.equal(l.display_status, 'on-time');
});

test('quitação retroativa não reduz multa já abonada nem modifica o histórico', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  const yesterday = addDays(today(), -1);
  l = await receipts(l, [{ amount: 125, fee_only: true, payment_date: yesterday }]);
  l = await waive(l);
  const before = await snapshot();
  const error = await receipts(l, [{ amount: 11000, payment_date: yesterday }], [], 409);
  assert.equal(error.error.code, 'WAIVER_DATE_CONFLICT');
  await confirm(l, [select(1, 125, yesterday)], 409);
  assert.deepEqual(await snapshot(), before);
});
