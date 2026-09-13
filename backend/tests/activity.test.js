import {beforeEach,afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import request from 'supertest';
import {app} from '../src/app.js';
import {openDatabase,closeDatabase,database} from '../src/config/database.js';
import {env} from '../src/config/env.js';
import {today,addDays} from '../src/shared/utils/dates.js';
import {hashPassword} from '../src/modules/auth/auth.service.js';
import {insertUser} from '../src/modules/auth/auth.repository.js';

let regular,admin,regularId,adminId;
const clientData={name:'Maria José',cpf:'52998224725'};
const events=()=>database().prepare('SELECT * FROM auth_audit_logs WHERE entity_type IS NOT NULL ORDER BY id').all();
const snapshot=()=>['clients','loans','installments','payments','late_fees','auth_audit_logs'].map(table=>database().prepare(`SELECT * FROM ${table}`).all());
beforeEach(async()=>{
  openDatabase(':memory:');
  const password=randomBytes(12).toString('base64url'),passwordHash=await hashPassword(password);
  regularId=insertUser({name:'Gabriel Albuquerque Silva',email:'gabriel@example.test',cpf:'11144477735',passwordHash},'user','active');
  database().prepare('INSERT INTO user_companies(user_id,company_id) VALUES(?,1)').run(regularId);
  adminId=insertUser({name:'Administrador teste',email:'admin@example.test',cpf:'12345678909',passwordHash},'admin','active');
  async function login(email) {
    const agent=request.agent(app),csrf=(await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
    const result=await agent.post('/api/auth/login').set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',csrf).send({email,password}).expect(200);
    agent.set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',result.body.csrfToken);
    return agent;
  }
  regular=await login('gabriel@example.test');admin=await login('admin@example.test');
});
afterEach(closeDatabase);
async function createLoan(overrides={}) {
  const client=(await regular.post('/api/clients').send(clientData).expect(201)).body;
  const input={client_id:client.id,principal_amount:120000,installment_count:2,loan_date:addDays(today(),-10),first_due_date:addDays(today(),-2),late_fee_per_day:100,...overrides};
  const loan=(await regular.post('/api/loans').send(input).expect(201)).body;
  return {client,loan,input};
}
const selection=(date=today(),fee=0)=>({installment_number:1,payment_date:date,late_fee_received_amount:fee});

test('created_by usa a sessão e notificações administrativas preservam nomes e detalhes da ação',async()=>{
  const {client,loan}=await createLoan();
  assert.equal(client.created_by,regularId);assert.equal(loan.created_by,regularId);
  const response=(await regular.post(`/api/installments/${loan.installments[0].id}/payments`).send({amount:1000,payment_date:today(),revision:loan.revision}).expect(201)).body;
  assert.equal(response.payment.created_by,regularId);assert.equal(response.payment.registered_by,'Gabriel Albuquerque Silva');
  assert.deepEqual(events().map(row=>row.event),['client_created','loan_created','payment_created']);
  assert.ok(events().every(row=>row.actor_id===regularId && row.actor_name==='Gabriel Albuquerque Silva'));
  database().prepare('UPDATE users SET name=? WHERE id=?').run('Nome posterior',regularId);
  await admin.patch(`/api/clients/${client.id}`).send({name:'Maria atualizada'}).expect(200);
  const notices=(await admin.get('/api/notifications').expect(200)).body;
  const created=notices.find(row=>row.event==='client_created'),borrowed=notices.find(row=>row.event==='loan_created'),paid=notices.find(row=>row.event==='payment_created');
  assert.equal(created.type,'registration');assert.equal(created.customer,'Maria José');assert.equal(created.responsible,'Gabriel Albuquerque Silva');
  assert.equal(borrowed.type,'loan');assert.equal(borrowed.amount,120000);assert.equal(borrowed.installment_count,2);
  assert.equal(borrowed.loan_date,loan.loan_date);assert.equal(borrowed.end_date,loan.installments.at(-1).due_date);
  assert.equal(paid.type,'payment');assert.equal(paid.responsibleId,regularId);assert.equal(paid.responsible,'Gabriel Albuquerque Silva');assert.equal(paid.customer,'Maria José');assert.equal(paid.installment,'1/2');
  assert.equal(notices.filter(row=>row.type==='payment').length,1);
  assert.equal(notices.find(row=>row.event==='client_updated').responsibleId,adminId);
  const history=(await admin.get(`/api/loans/${loan.id}`).expect(200)).body.payments;
  assert.equal(history[0].registered_by,'Gabriel Albuquerque Silva');assert.equal(history[0].created_by,regularId);
  assert.ok(!(await regular.get('/api/notifications').expect(200)).body.some(row=>row.event));
  const before=events();await admin.get('/api/notifications').expect(200);assert.deepEqual(events(),before);
});

test('correção, estorno e multa registram seus autores sem sobrescrever quem lançou originalmente',async()=>{
  let {loan}=await createLoan({installment_count:1});
  loan=(await regular.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[selection(addDays(today(),-1))]}).expect(200)).body;
  const original=loan.payments[0];assert.equal(original.created_by,regularId);
  loan=(await admin.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[selection()]}).expect(200)).body;
  const previous=loan.payments.find(row=>row.id===original.id),corrected=loan.payments.find(row=>!row.voided_at);
  assert.ok(previous.voided_at);assert.equal(previous.created_by,regularId);assert.equal(corrected.created_by,adminId);
  assert.ok(events().some(row=>row.event==='payment_voided' && row.entity_id===original.id && row.actor_id===adminId));
  assert.ok(events().some(row=>row.event==='payment_corrected' && row.entity_id===corrected.id && row.actor_id===adminId));
  const count=events().length;
  loan=(await admin.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[selection()]}).expect(200)).body;
  assert.equal(events().length,count);
  const feeId=database().prepare('SELECT id FROM late_fees WHERE installment_id=?').get(loan.installments[0].id).id;
  loan=(await regular.post(`/api/late-fees/${feeId}/payments`).send({amount:100,payment_date:today(),revision:loan.revision}).expect(201)).body.loan;
  const feePayment=loan.payments.find(row=>row.late_fee_amount===100);assert.equal(feePayment.created_by,regularId);
  loan=(await admin.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[]}).expect(200)).body;
  assert.ok(loan.payments.every(row=>row.voided_at));
  assert.ok(events().some(row=>row.event==='payment_voided' && row.entity_id===feePayment.id && row.actor_id===adminId));
  const notices=(await admin.get('/api/notifications').expect(200)).body;
  assert.ok(notices.some(row=>row.event==='payment_corrected' && row.responsibleId===adminId));
  assert.ok(notices.some(row=>row.event==='payment_voided' && row.responsibleId===adminId));
});

test('alterações de contrato e parcelas são auditadas pelo usuário autenticado',async()=>{
  let {loan}=await createLoan();
  loan=(await admin.patch(`/api/loans/${loan.id}/installments`).send({revision:loan.revision,installments:[50000,70000]}).expect(200)).body;
  loan=(await admin.patch(`/api/loans/${loan.id}`).send({revision:loan.revision,notes:'Nota do contrato'}).expect(200)).body;
  await admin.patch(`/api/loans/${loan.id}`).send({revision:loan.revision,status:'cancelled'}).expect(200);
  for(const event of ['installments_updated','loan_updated','loan_cancelled'])assert.equal(events().find(row=>row.event===event).actor_id,adminId);
  assert.equal(database().prepare('SELECT created_by FROM loans WHERE id=?').get(loan.id).created_by,regularId);
});

test('payload não pode forjar responsável em cadastros, contratos, pagamentos, multas ou confirmação',async()=>{
  const {client,loan,input}=await createLoan();
  const feeId=database().prepare('SELECT id FROM late_fees WHERE installment_id=?').get(loan.installments[0].id).id;
  for(const field of ['created_by','createdBy','user_id','responsible','registeredBy','actor_id']) {
    const injected={[field]:adminId};
    const before=snapshot();
    await regular.post('/api/clients').send({...clientData,...injected}).expect(400);
    await regular.patch(`/api/clients/${client.id}`).send(injected).expect(400);
    await regular.post('/api/loans').send({...input,...injected}).expect(400);
    await regular.patch(`/api/loans/${loan.id}`).send({revision:loan.revision,...injected}).expect(400);
    await regular.post(`/api/installments/${loan.installments[0].id}/payments`).send({amount:100,payment_date:today(),revision:loan.revision,...injected}).expect(400);
    await regular.post(`/api/late-fees/${feeId}/payments`).send({amount:100,payment_date:today(),revision:loan.revision,...injected}).expect(400);
    await regular.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[{...selection(),...injected}]}).expect(400);
    await regular.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[selection()],...injected}).expect(400);
    assert.deepEqual(snapshot(),before);
  }
});

test('falha da auditoria reverte lançamentos, correções e cadastros sem notificação fantasma',async()=>{
  let {loan}=await createLoan({installment_count:1});
  database().exec("CREATE TRIGGER fail_activity BEFORE INSERT ON auth_audit_logs WHEN NEW.entity_type IS NOT NULL BEGIN SELECT RAISE(ABORT,'audit failed'); END");
  let before=snapshot();
  await regular.post(`/api/installments/${loan.installments[0].id}/payments`).send({amount:100,payment_date:today(),revision:loan.revision}).expect(409);
  assert.deepEqual(snapshot(),before);
  await regular.post('/api/clients').send({name:'Outro cliente',cpf:'98765432100'}).expect(409);
  assert.deepEqual(snapshot(),before);
  database().exec('DROP TRIGGER fail_activity');
  loan=(await regular.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[selection(addDays(today(),-1))]}).expect(200)).body;
  database().exec("CREATE TRIGGER fail_correction BEFORE INSERT ON auth_audit_logs WHEN NEW.event='payment_corrected' BEGIN SELECT RAISE(ABORT,'audit failed'); END");
  before=snapshot();
  await admin.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[selection()]}).expect(409);
  assert.deepEqual(snapshot(),before);
});
