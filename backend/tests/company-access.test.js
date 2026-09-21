import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase, database } from './database-helper.js';
import { injectFailure } from './database-helper.js';
import { newSession } from '../src/modules/auth/auth.service.js';
import { insertUser } from '../src/modules/auth/auth.repository.js';
import { replaceUserCompanies } from '../src/modules/companies/companies.repository.js';
import { withCompanyAccess } from '../src/shared/middleware/company-access.js';
import { env } from '../src/config/env.js';
import { authConfig } from '../src/config/auth.js';
import { today, addDays } from '../src/shared/utils/dates.js';

let admin, a, b, both, clientIndex;
async function account(role, companies=[]) {
  const id=(await insertUser({name:`Pessoa ${Math.random()}`,email:`${Math.random()}@example.test`,cpf:null,passwordHash:'offline-test'},role,'active'));
  (await replaceUserCompanies(id,companies));
  const session=(await newSession(id));
  const api=request.agent(app).set('Cookie',`${authConfig.cookieName}=${session.token}`).set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',session.csrfToken);
  return {id,api};
}
beforeEach(async () => {(await openDatabase(':memory:')); clientIndex=0; admin=(await account('admin')); a=(await account('user',[1])); b=(await account('user',[2])); both=(await account('user',[1,2]));});
afterEach(closeDatabase);
const clientBody={name:'Cliente isolado',cpf:'52998224725'};
async function create(api,company_id,name='Cliente isolado') {
  const client=(await api.post('/api/clients').send({...clientBody,name,cpf:['52998224725','11144477735','12345678909'][clientIndex++]}).expect(201)).body;
  const loan=(await api.post('/api/loans').send({company_id,client_id:client.id,principal_amount:10000,interest_percentage:'10',installment_count:2,
    loan_date:addDays(today(),-10),first_due_date:addDays(today(),-2),late_fee_per_day:100}).expect(201)).body;
  return {client,loan};
}
const snapshot=async ()=>(await Promise.all(['clients','loans','installments','payments','late_fees'].map(async table=>(await database().prepare(`SELECT * FROM ${table}`).all()))));

test('cliente global, criação por empresa e listas ativas, quitadas e negativadas persistem isoladamente', async () => {
  const client = (await admin.api.post('/api/clients').send(clientBody).expect(201)).body;
  assert.equal(client.company_id, undefined);
  const body = { client_id:client.id, principal_amount:10000, installment_count:1, loan_date:today(), first_due_date:today() };
  await admin.api.post('/api/loans').send(body).expect(400);
  await both.api.post('/api/loans').send(body).expect(400);
  await a.api.post('/api/loans').send({...body,company_id:2}).expect(403);
  await admin.api.post('/api/loans').send({...body,company_id:999}).expect(403);
  const withoutAccess = await account('user');
  await withoutAccess.api.post('/api/loans').send({...body,company_id:1}).expect(403);
  const first = (await a.api.post('/api/loans').send(body).expect(201)).body;
  const second = (await admin.api.post('/api/loans').send({...body,company_id:2}).expect(201)).body;
  assert.deepEqual((await database().prepare('SELECT client_id,company_id FROM loans ORDER BY id').all()), [
    {client_id:client.id,company_id:1}, {client_id:client.id,company_id:2},
  ]);
  assert.equal((await a.api.get(`/api/clients/${client.id}`).expect(200)).body.loans.length,1);
  assert.equal((await b.api.get(`/api/clients/${client.id}`).expect(200)).body.loans[0].id,second.id);
  await a.api.post(`/api/installments/${first.installments[0].id}/payments`).send({revision:first.revision,amount:10000,payment_date:today()}).expect(201);
  assert.equal((await database().prepare('SELECT status FROM loans WHERE id=?').get(first.id)).status,'paid');
  assert.equal((await a.api.get('/api/loans?status=active').expect(200)).body.total,0);
  assert.equal((await a.api.get('/api/loans?status=paid').expect(200)).body.items[0].id,first.id);
  assert.equal((await b.api.get('/api/loans?status=paid').expect(200)).body.total,0);
  const negative = (await b.api.post('/api/loans').send({...body,loan_date:addDays(today(),-10),first_due_date:addDays(today(),-5)}).expect(201)).body;
  assert.equal((await admin.api.get('/api/loans?status=overdue&company_id=2').expect(200)).body.items[0].id,negative.id);
  assert.equal((await a.api.get('/api/loans?status=overdue&company_id=2').expect(200)).body.total,0);
  assert.equal((await admin.api.get('/api/loans?status=paid&company_id=2').expect(200)).body.total,0);
  assert.equal((await admin.api.get('/api/loans?status=active').expect(200)).body.total,2);
  assert.equal((await a.api.get(`/api/loans/${first.id}`).expect(200)).body.payments.length,1);
  await b.api.get(`/api/loans/${first.id}`).expect(404);
  assert.equal((await b.api.get(`/api/loans/${second.id}`).expect(200)).body.payments.length,0);
  await withCompanyAccess({role:'user',companyIds:[1]},async () => {
    await assert.rejects(database().prepare('UPDATE loans SET company_id=1 WHERE id=?').run(second.id));
  });
  await assert.rejects(database().prepare('UPDATE loans SET company_id=2 WHERE id=?').run(first.id));
});

test('empresas dinâmicas, múltiplos vínculos, filtros e clientes globais e documentos únicos',async()=>{
  const first=await create(a.api,undefined,'Empresa A'),second=await create(b.api,undefined,'Empresa B');
  assert.equal(first.client.company_id,undefined);assert.equal(second.loan.company_id,2);
  assert.equal(first.loan.company_name,'Dinheiro Express');
  assert.equal(second.loan.company_name,'Platinum Finance');
  assert.deepEqual((await both.api.get('/api/loans').expect(200)).body.items.map(row=>row.company_name),['Platinum Finance','Dinheiro Express']);
  for (const path of ['loans']) {
    assert.equal((await a.api.get(`/api/${path}`).expect(200)).body.total,1);
    assert.equal((await both.api.get(`/api/${path}`).expect(200)).body.total,2);
    assert.equal((await admin.api.get(`/api/${path}`).expect(200)).body.total,2);
    assert.equal((await admin.api.get(`/api/${path}?company_id=2`).expect(200)).body.items[0].company_id,2);
    assert.equal((await a.api.get(`/api/${path}?company_id=2`).expect(200)).body.total,0);
  }
  await a.api.post('/api/clients').send(clientBody).expect(409);
  await admin.api.post('/api/clients').send(clientBody).expect(409);
  await both.api.post('/api/clients').send(clientBody).expect(409);
  await a.api.post('/api/companies').send({name:'Não permitido'}).expect(403);
  const company=(await admin.api.post('/api/companies').send({name:'Terceira empresa'}).expect(201)).body;
  await admin.api.post('/api/companies').send({name:' terceira empresa '}).expect(409);
  assert.equal((await admin.api.get('/api/companies').expect(200)).body.length,3);
  assert.deepEqual((await a.api.get('/api/companies').expect(200)).body.map(row=>row.id),[1]);
  await admin.api.patch(`/api/users/${a.id}/access`).send({action:'edit',role:'user',companyIds:[1,company.id]}).expect(200);
  assert.equal((await a.api.get('/api/companies').expect(200)).body.length,2);
  await create(a.api,company.id,'Empresa C');
});

test('IDs de outra empresa não permitem ler, editar, pagar, corrigir ou consultar multas',async()=>{
  const {client,loan}=await create(b.api);
  const before=(await snapshot()), installment=loan.installments[0], fee=installment.late_fee_id;
  for(const path of [`loans/${loan.id}`,`loans/${loan.id}/installments`,`late-fees/${fee}`]) await a.api.get(`/api/${path}`).expect(404);
  await a.api.patch(`/api/loans/${loan.id}`).send({revision:loan.revision,status:'cancelled'}).expect(404);
  await a.api.patch(`/api/loans/${loan.id}/installments`).send({revision:loan.revision,installments:[5500,5500]}).expect(404);
  await a.api.post(`/api/installments/${installment.id}/payments`).send({revision:loan.revision,amount:100,payment_date:today()}).expect(404);
  await a.api.post(`/api/installments/${installment.id}/payment-preview`).send({payment_date:today()}).expect(404);
  await a.api.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[]}).expect(404);
  await a.api.post(`/api/late-fees/${fee}/payments`).send({revision:loan.revision,amount:100,payment_date:today()}).expect(404);
  await a.api.post('/api/clients').send({...clientBody,company_id:2}).expect(400);
  await a.api.post('/api/loans').send({company_id:2,client_id:client.id,principal_amount:100,installment_count:1,loan_date:today(),first_due_date:today()}).expect(403);
  await both.api.post('/api/loans').send({client_id:client.id,principal_amount:100,installment_count:1,loan_date:today(),first_due_date:today()}).expect(400);
  await admin.api.patch(`/api/clients/${client.id}`).send({company_id:1}).expect(400);
  assert.deepEqual((await snapshot()),before);
});

test('editar empresa persiste somente o nome e mantém empréstimos, vínculos e isolamento',async()=>{
  const {loan}=await create(b.api);
  const before=await snapshot();
  const memberships=await database().prepare('SELECT * FROM user_companies ORDER BY user_id,company_id').all();
  const renamed=(await admin.api.patch('/api/companies/2').send({name:'  Platinum Renomeada  '}).expect(200)).body;
  assert.deepEqual(renamed,{id:2,name:'Platinum Renomeada'});
  assert.equal((await database().prepare('SELECT name FROM companies WHERE id=2').get()).name,renamed.name);
  assert.deepEqual(await snapshot(),before);
  assert.deepEqual(await database().prepare('SELECT * FROM user_companies ORDER BY user_id,company_id').all(),memberships);
  for (const api of [admin.api,b.api,both.api]) {
    assert.equal((await api.get(`/api/loans/${loan.id}`).expect(200)).body.company_name,renamed.name);
    assert.equal((await api.get('/api/loans?company_id=2').expect(200)).body.items[0].company_name,renamed.name);
    assert.equal((await api.get('/api/companies').expect(200)).body.find(row=>row.id===2).name,renamed.name);
  }
  await a.api.get(`/api/loans/${loan.id}`).expect(404);
  assert.equal((await a.api.get('/api/loans?company_id=2').expect(200)).body.total,0);
  const audit=await database().prepare("SELECT * FROM auth_audit_logs WHERE event='company_updated'").get();
  assert.equal(audit.actor_id,admin.id);assert.equal(audit.entity_id,2);
});

test('edição de empresa exige administrador, sessão, CSRF e nome válido sem alterar IDs',async()=>{
  for (const api of [a.api,b.api,both.api]) await api.patch('/api/companies/2').send({name:'Invadida'}).expect(403);
  await request(app).patch('/api/companies/2').send({name:'Invadida'}).expect(401);
  await admin.api.patch('/api/companies/2').set('X-CSRF-Token','invalid').send({name:'Invadida'}).expect(403);
  for (const body of [{},{name:''},{name:'  '},{name:'A'},{name:'A'.repeat(151)},{name:123},{name:'Válido',id:3},{name:'Válido',company_id:1}])
    await admin.api.patch('/api/companies/2').send(body).expect(400);
  for (const id of ['0','-1','abc','1.5']) await admin.api.patch(`/api/companies/${id}`).send({name:'Válido'}).expect(400);
  await admin.api.patch('/api/companies/999').send({name:'Válido'}).expect(404);
  const duplicate=await admin.api.patch('/api/companies/2').send({name:' dinheiro express '}).expect(409);
  assert.equal(duplicate.body.error.code,'COMPANY_EXISTS');
  await admin.api.patch('/api/companies/2').send({name:'Platinum Finance'}).expect(200);
  assert.equal((await database().prepare('SELECT name FROM companies WHERE id=2').get()).name,'Platinum Finance');
});

test('falha na auditoria reverte a edição da empresa',async()=>{
  await injectFailure({name:'fail_company_update',event:'INSERT',table:'auth_audit_logs',condition:"NEW.event='company_updated'"});
  await admin.api.patch('/api/companies/2').send({name:'Não persistir'}).expect(409);
  assert.equal((await database().prepare('SELECT name FROM companies WHERE id=2').get()).name,'Platinum Finance');
});

test('dashboard, relatórios, notificações e históricos incluem somente empresas permitidas',async()=>{
  await create(a.api,undefined,'Visível A');
  const {loan}=await create(b.api,undefined,'Segredo B');
  await b.api.post(`/api/installments/${loan.installments[0].id}/payments`).send({revision:loan.revision,amount:100,payment_date:today()}).expect(201);
  for(const path of ['/dashboard/summary',`/reports?mode=month&start=${today().slice(0,7)}-01&end=${today()}`,
    `/reports?start=${addDays(today(),-10)}&end=${today()}`,'/notifications']) {
    const result=(await a.api.get(`/api${path}`).expect(200)).body;
    assert.ok(!JSON.stringify(result).includes('Segredo B'),path);
  }
  assert.equal((await a.api.get('/api/dashboard/summary').expect(200)).body.received,0);
  assert.equal((await admin.api.get('/api/dashboard/summary').expect(200)).body.received,100);
});

test('aprovação valida empresas; mudanças de empresa e papel valem na sessão existente',async()=>{
  const {loan}=await create(b.api);
  const pending=(await insertUser({name:'Pendente',email:'pending@example.test',cpf:null,passwordHash:'offline'},'user','pending'));
  for(const body of [{action:'approve'},{action:'approve',role:'user',companyIds:[]},{action:'approve',role:'user',companyIds:[999]},{action:'approve',role:'master'}])
    await admin.api.patch(`/api/users/${pending}/access`).send(body).expect(400);
  await admin.api.patch(`/api/users/${pending}/access`).send({action:'approve',companyIds:[1,2]}).expect(200);
  assert.equal((await database().prepare('SELECT role FROM users WHERE id=?').get(pending)).role,'user');
  await admin.api.patch(`/api/users/${both.id}/access`).send({action:'edit',role:'user',companyIds:[1]}).expect(200);
  await both.api.get(`/api/loans/${loan.id}`).expect(404);
  await admin.api.patch(`/api/users/${both.id}/access`).send({action:'edit',role:'admin'}).expect(200);
  await both.api.get(`/api/loans/${loan.id}`).expect(200);
  await both.api.get('/api/users').expect(200);
  await admin.api.patch(`/api/users/${both.id}/access`).send({action:'edit',role:'user',companyIds:[1]}).expect(200);
  await both.api.get(`/api/loans/${loan.id}`).expect(404);
  await both.api.get('/api/users').expect(403);
  await a.api.patch(`/api/users/${a.id}/access`).send({action:'edit',role:'admin'}).expect(403);
  await admin.api.patch(`/api/users/${a.id}/access`).send({action:'edit',role:'user',companyIds:[]}).expect(400);
});

test('guardas de banco impedem mutações fora do escopo e contexto não vaza entre requisições',async()=>{
  const {loan}=await create(b.api);
  await withCompanyAccess({role:'user',companyIds:[1]},async ()=>{
    (await assert.rejects(async ()=>(await database().prepare('DELETE FROM loans WHERE id=?').run(loan.id))));
    (await assert.rejects(async ()=>(await database().prepare('INSERT INTO payments(installment_id,amount,payment_date) VALUES(?,100,?)').run(loan.installments[0].id,today()))));
  });
  const results=await Promise.all(Array.from({length:12},(_,i)=>(i%2 ? b.api : a.api).get('/api/loans')));
  results.forEach((result,i)=>assert.equal(result.body.total,i%2 ? 1 : 0));
  await request(app).get('/api/clients').expect(401);
});

test('papel MANAGER não concede acesso financeiro a empresas sem vínculo',async()=>{
  await admin.api.patch(`/api/companies/1/users/${a.id}`).send({role:'MANAGER'}).expect(200);
  const {client,loan}=await create(b.api,undefined,'Restrito B');
  for(const path of [`loans/${loan.id}`,`loans/${loan.id}/installments`,`late-fees/${loan.installments[0].late_fee_id}`]) await a.api.get(`/api/${path}`).expect(404);
  assert.equal((await a.api.get(`/api/clients/${client.id}`).expect(200)).body.loans.length,0);
  assert.equal((await a.api.get('/api/loans?company_id=2').expect(200)).body.total,0);
  for(const path of ['/dashboard/summary',`/reports?start=${addDays(today(),-10)}&end=${today()}`,'/notifications'])
    assert.ok(!JSON.stringify((await a.api.get(`/api${path}`).expect(200)).body).includes('Restrito B'));
  await a.api.patch(`/api/loans/${loan.id}`).send({revision:loan.revision,status:'cancelled'}).expect(404);
  await a.api.post(`/api/installments/${loan.installments[0].id}/payments`).send({revision:loan.revision,amount:100,payment_date:today()}).expect(404);
});
