import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase, database } from '../src/config/database.js';
import { today, addDays } from '../src/shared/utils/dates.js';
import { env } from '../src/config/env.js';
import { seedDevelopment } from '../database/seed.js';
import { createMaster } from '../src/modules/auth/auth.service.js';
import { randomBytes } from 'node:crypto';

let api;
const clientData = {
  name: 'Cliente de teste',
  cpf: '529.982.247-25',
  rg: '12.345-X',
  cnh: '12345678901',
};
beforeEach(async () => {
  openDatabase(':memory:');
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
function snapshot() {
  return ['clients', 'loans', 'installments', 'payments', 'late_fees'].map((table) =>
    database().prepare(`SELECT * FROM ${table}`).all(),
  );
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
  assert.equal(database().prepare('SELECT COUNT(*) n FROM loans').get().n, 0);
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
  l = await pay(l, 11000);
  const i = l.installments[0];
  assert.equal(i.status, 'paid');
  assert.equal(i.amount, 11000);
  assert.equal(i.late_fee_amount, 500);
  assert.equal(l.status, 'overdue');
  assert.equal((await api.get(`/api/clients/${l.client_id}`)).body.status, 'negativado');
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
  database()
    .prepare('UPDATE installments SET due_date=?')
    .run(addDays(today(), -env.ATTENTION_DAYS - 1));
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
  const before = snapshot();
  const error = await confirm(l, [], 409);
  assert.equal(error.error.code, 'STALE_LOAN');
  assert.deepEqual(snapshot(), before);
});
test('valida excesso de pagamento, multa e cronologia', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  await api
    .post(`/api/installments/${l.installments[0].id}/payments`)
    .send({ amount: 11001, payment_date: today(), revision: l.revision })
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
  const before = snapshot();
  await confirm(l, [select(1), select(2, 999)], 409);
  assert.deepEqual(snapshot(), before);
});
test('rollback de empréstimo se INSERT de parcela falhar', async () => {
  const c = await client();
  database().exec(
    "CREATE TRIGGER fail_installment BEFORE INSERT ON installments WHEN NEW.installment_number=2 BEGIN SELECT RAISE(ABORT,'injected failure'); END",
  );
  const before = snapshot();
  await api
    .post('/api/loans')
    .send({
      client_id: c.id,
      principal_amount: 1000,
      installment_count: 2,
      loan_date: today(),
      first_due_date: today(),
    })
    .expect(409);
  assert.deepEqual(snapshot(), before);
});
test('rollback de pagamento se atualização de status falhar', async () => {
  const l = await loan({ installment_count: 1 });
  database().exec(
    "CREATE TRIGGER fail_status BEFORE UPDATE OF status ON loans WHEN NEW.status='paid' BEGIN SELECT RAISE(ABORT,'injected failure'); END",
  );
  const before = snapshot();
  await api
    .post(`/api/installments/${l.installments[0].id}/payments`)
    .send({ amount: 11000, payment_date: today(), revision: l.revision })
    .expect(409);
  assert.deepEqual(snapshot(), before);
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

test('prévia congela multa na quitação e multa retroativa não excede saldo da data', async () => {
  let l = await loan({ installment_count: 1, first_due_date: addDays(today(), -4) });
  const feeId = l.installments[0].late_fee_id;
  await api
    .post(`/api/late-fees/${feeId}/payments`)
    .send({ amount: 500, payment_date: addDays(today(), -2), revision: l.revision })
    .expect(409);
  l = await pay(l, 11000, addDays(today(), -2));
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
test('seed é atômico, idempotente e inclui todos os cenários', () => {
  assert.equal(seedDevelopment(), 6);
  const before = snapshot();
  assert.equal(seedDevelopment(), 0);
  assert.deepEqual(snapshot(), before);
  assert.ok(before[1].some((l) => l.status === 'paid'));
  assert.ok(before[2].some((i) => i.status === 'partial'));
  assert.ok(before[4].some((f) => f.amount > f.paid_amount));
});
