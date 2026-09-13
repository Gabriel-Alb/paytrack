import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase, database } from '../src/config/database.js';
import { newSession } from '../src/modules/auth/auth.service.js';
import { insertUser } from '../src/modules/auth/auth.repository.js';
import { replaceUserCompanies } from '../src/modules/companies/companies.repository.js';
import { withCompanyAccess } from '../src/shared/middleware/company-access.js';
import { env } from '../src/config/env.js';
import { authConfig } from '../src/config/auth.js';
import { today, addDays } from '../src/shared/utils/dates.js';

let admin, a, b, both;
function account(role, companies=[]) {
  const id=insertUser({name:`Pessoa ${Math.random()}`,email:`${Math.random()}@example.test`,cpf:null,passwordHash:'offline-test'},role,'active');
  replaceUserCompanies(id,companies);
  const session=newSession(id);
  const api=request.agent(app).set('Cookie',`${authConfig.cookieName}=${session.token}`).set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',session.csrfToken);
  return {id,api};
}
beforeEach(() => {openDatabase(':memory:'); admin=account('admin'); a=account('user',[1]); b=account('user',[2]); both=account('user',[1,2]);});
afterEach(closeDatabase);
const clientBody={name:'Cliente isolado',cpf:'52998224725'};
async function create(api,company_id,name='Cliente isolado') {
  const client=(await api.post('/api/clients').send({...clientBody,name,company_id}).expect(201)).body;
  const loan=(await api.post('/api/loans').send({company_id,client_id:client.id,principal_amount:10000,interest_percentage:'10',installment_count:2,
    loan_date:addDays(today(),-10),first_due_date:addDays(today(),-2),late_fee_per_day:100}).expect(201)).body;
  return {client,loan};
}
const snapshot=()=>['clients','loans','installments','payments','late_fees'].map(table=>database().prepare(`SELECT * FROM ${table}`).all());

test('empresas dinâmicas, múltiplos vínculos, filtros e documentos únicos por empresa',async()=>{
  const first=await create(a.api,undefined,'Empresa A'),second=await create(b.api,undefined,'Empresa B');
  assert.equal(first.client.company_id,1);assert.equal(second.loan.company_id,2);
  for (const path of ['clients','loans']) {
    assert.equal((await a.api.get(`/api/${path}`).expect(200)).body.total,1);
    assert.equal((await both.api.get(`/api/${path}`).expect(200)).body.total,2);
    assert.equal((await admin.api.get(`/api/${path}`).expect(200)).body.total,2);
    assert.equal((await admin.api.get(`/api/${path}?company_id=2`).expect(200)).body.items[0].company_id,2);
    assert.equal((await a.api.get(`/api/${path}?company_id=2`).expect(200)).body.total,0);
  }
  await a.api.post('/api/clients').send(clientBody).expect(409);
  await admin.api.post('/api/clients').send(clientBody).expect(400);
  await both.api.post('/api/clients').send(clientBody).expect(400);
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
  const before=snapshot(), installment=loan.installments[0], fee=installment.late_fee_id;
  for(const path of [`clients/${client.id}`,`loans/${loan.id}`,`loans/${loan.id}/installments`,`late-fees/${fee}`]) await a.api.get(`/api/${path}`).expect(404);
  await a.api.patch(`/api/clients/${client.id}`).send({name:'Invadido'}).expect(404);
  await a.api.put(`/api/clients/${client.id}`).send({status:'negativado'}).expect(404);
  await a.api.patch(`/api/loans/${loan.id}`).send({revision:loan.revision,status:'cancelled'}).expect(404);
  await a.api.patch(`/api/loans/${loan.id}/installments`).send({revision:loan.revision,installments:[5500,5500]}).expect(404);
  await a.api.post(`/api/installments/${installment.id}/payments`).send({revision:loan.revision,amount:100,payment_date:today()}).expect(404);
  await a.api.post(`/api/installments/${installment.id}/payment-preview`).send({payment_date:today()}).expect(404);
  await a.api.put(`/api/loans/${loan.id}/payment-confirmation`).send({revision:loan.revision,payments:[]}).expect(404);
  await a.api.post(`/api/late-fees/${fee}/payments`).send({revision:loan.revision,amount:100,payment_date:today()}).expect(404);
  await a.api.post('/api/clients').send({...clientBody,company_id:2}).expect(403);
  await a.api.post('/api/loans').send({company_id:1,client_id:client.id,principal_amount:100,installment_count:1,loan_date:today(),first_due_date:today()}).expect(404);
  await both.api.post('/api/loans').send({company_id:1,client_id:client.id,principal_amount:100,installment_count:1,loan_date:today(),first_due_date:today()}).expect(400);
  await admin.api.patch(`/api/clients/${client.id}`).send({company_id:1}).expect(400);
  assert.deepEqual(snapshot(),before);
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
  const {client}=await create(b.api);
  const pending=insertUser({name:'Pendente',email:'pending@example.test',cpf:null,passwordHash:'offline'},'user','pending');
  for(const body of [{action:'approve'},{action:'approve',role:'user',companyIds:[]},{action:'approve',role:'user',companyIds:[999]},{action:'approve',role:'master'}])
    await admin.api.patch(`/api/users/${pending}/access`).send(body).expect(400);
  await admin.api.patch(`/api/users/${pending}/access`).send({action:'approve',companyIds:[1,2]}).expect(200);
  assert.equal(database().prepare('SELECT role FROM users WHERE id=?').get(pending).role,'user');
  await admin.api.patch(`/api/users/${both.id}/access`).send({action:'edit',role:'user',companyIds:[1]}).expect(200);
  await both.api.get(`/api/clients/${client.id}`).expect(404);
  await admin.api.patch(`/api/users/${both.id}/access`).send({action:'edit',role:'admin'}).expect(200);
  await both.api.get(`/api/clients/${client.id}`).expect(200);
  await both.api.get('/api/users').expect(200);
  await admin.api.patch(`/api/users/${both.id}/access`).send({action:'edit',role:'user',companyIds:[1]}).expect(200);
  await both.api.get(`/api/clients/${client.id}`).expect(404);
  await both.api.get('/api/users').expect(403);
  await a.api.patch(`/api/users/${a.id}/access`).send({action:'edit',role:'admin'}).expect(403);
  await admin.api.patch(`/api/users/${a.id}/access`).send({action:'edit',role:'user',companyIds:[]}).expect(400);
});

test('guardas de banco impedem mutações fora do escopo e contexto não vaza entre requisições',async()=>{
  const {client,loan}=await create(b.api);
  withCompanyAccess({role:'user',companyIds:[1]},()=>{
    assert.throws(()=>database().prepare('UPDATE clients SET name=? WHERE id=?').run('Invasão',client.id));
    assert.throws(()=>database().prepare('DELETE FROM loans WHERE id=?').run(loan.id));
    assert.throws(()=>database().prepare('INSERT INTO payments(installment_id,amount,payment_date) VALUES(?,100,?)').run(loan.installments[0].id,today()));
  });
  const results=await Promise.all(Array.from({length:12},(_,i)=>(i%2 ? b.api : a.api).get('/api/clients')));
  results.forEach((result,i)=>assert.equal(result.body.total,i%2 ? 1 : 0));
  await request(app).get('/api/clients').expect(401);
});
