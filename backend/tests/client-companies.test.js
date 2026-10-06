import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase, database, injectFailure } from './database-helper.js';
import { insertUser } from '../src/modules/auth/auth.repository.js';
import { newSession } from '../src/modules/auth/auth.service.js';
import { replaceUserCompanies } from '../src/modules/companies/companies.repository.js';
import { withCompanyAccess } from '../src/application/company-access.js';
import { authConfig } from '../src/config/auth.js';
import { env } from '../src/config/env.js';
import { today } from '../src/shared/utils/dates.js';

let admin, a, b, both, none;
const body = {name:'Maria Empresa A',cpf:'52998224725',companyIds:[1]};
async function account(role, companyIds = []) {
  const id = await insertUser({name:'Pessoa',email:`${Math.random()}@example.test`,cpf:null,passwordHash:'offline'},role,'active');
  await replaceUserCompanies(id, companyIds);
  const session = await newSession(id);
  return request.agent(app).set('Cookie',`${authConfig.cookieName}=${session.token}`)
    .set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',session.csrfToken);
}
const snapshot = () => Promise.all(['clients','client_companies','loans','installments','payments','late_fees','auth_audit_logs']
  .map(table => database().prepare(`SELECT * FROM ${table}`).all()));
const loanBody = (client_id, company_id) => ({client_id,company_id,principal_amount:10000,installment_count:1,loan_date:today(),first_due_date:today()});
beforeEach(async () => {
  await openDatabase();
  admin = await account('admin'); a = await account('user',[1]); b = await account('user',[2]);
  both = await account('user',[1,2]); none = await account('user');
});
afterEach(closeDatabase);

test('listagem, busca, paginação, ID, PUT/PATCH e filtros isolam clientes mesmo sem empréstimos', async () => {
  const first = (await a.post('/api/clients').send(body).expect(201)).body;
  const second = (await b.post('/api/clients').send({...body,name:'Segredo B',cpf:'11144477735',companyIds:[2]}).expect(201)).body;
  const orphan = (await database().prepare("INSERT INTO clients(name,cpf) VALUES('Legado sem contrato','12345678909')").run()).lastInsertRowid;
  for (const [api, ids] of [[a,[first.id]],[b,[second.id]],[both,[second.id,first.id]],[admin,[orphan,second.id,first.id]],[none,[]]]) {
    const result = (await api.get('/api/clients').expect(200)).body;
    assert.deepEqual(result.items.map(client=>client.id),ids);
    assert.equal(result.total,ids.length);
  }
  for (const query of ['search=Segredo','search=11144477735','company_id=2','companyId=2&companyIds=2','page=2&limit=1']) {
    const result = (await a.get('/api/clients?'+query).expect(200)).body;
    assert.ok(!JSON.stringify(result).includes('Segredo'));
    if (!query.includes('companyId=')) assert.equal(result.items.length,0);
  }
  const before = await snapshot();
  for (const id of [second.id,orphan]) {
    await a.get('/api/clients/'+id).expect(404);
    for (const method of ['patch','put']) await a[method]('/api/clients/'+id).send({name:'Invadido'}).expect(404);
  }
  assert.deepEqual(await snapshot(),before);
  await a.patch('/api/clients/'+first.id).send({phone:'11999990000'}).expect(200);
  await admin.patch('/api/clients/'+orphan).send({companyIds:[1,2]}).expect(200);
  await a.get('/api/clients/'+orphan).expect(200);
  await b.get('/api/clients/'+orphan).expect(200);
});

test('empresa obrigatória, escopo e campos forjados são validados na API sem escrita parcial', async () => {
  const before = await snapshot();
  for (const companyIds of [undefined,[],[1,1],[0],['abc'],[1.5],null])
    await a.post('/api/clients').send({...body,companyIds}).expect(400);
  for (const companyIds of [[2],[1,2],[999]]) await a.post('/api/clients').send({...body,companyIds}).expect(403);
  for (const field of ['company_id','companyId','companies','role'])
    await a.post('/api/clients').send({...body,[field]:2}).expect(400);
  await none.post('/api/clients').send(body).expect(403);
  assert.deepEqual(await snapshot(),before);
  const client = (await both.post('/api/clients').send({...body,companyIds:[1,2]}).expect(201)).body;
  assert.deepEqual([...client.companyIds].sort(),[1,2]);
  assert.deepEqual((await a.get('/api/clients/'+client.id).expect(200)).body.companyIds,[1]);
  for (const api of [a,both]) await api.patch('/api/clients/'+client.id).send({companyIds:[1]}).expect(403);
  for (const field of ['company_id','companyId']) await a.patch('/api/clients/'+client.id).send({[field]:2}).expect(400);
  await admin.patch('/api/clients/'+client.id).send({companyIds:[2]}).expect(200);
  await a.get('/api/clients/'+client.id).expect(404);
  await admin.patch('/api/clients/'+client.id).send({companyIds:[1,2]}).expect(200);
  assert.equal((await database().prepare('SELECT COUNT(*) n FROM client_companies').get()).n,2);
});

test('criação e edição de empréstimos validam cliente + empresa; vínculos usados preservam pagamentos', async () => {
  const first = (await admin.post('/api/clients').send(body).expect(201)).body;
  const second = (await admin.post('/api/clients').send({...body,cpf:'11144477735',companyIds:[2]}).expect(201)).body;
  for (const api of [both,admin]) await api.post('/api/loans').send(loanBody(first.id,2)).expect(409);
  await a.post('/api/loans').send(loanBody(second.id,1)).expect(404);
  let loan = (await a.post('/api/loans').send(loanBody(first.id,1)).expect(201)).body;
  loan = (await a.post(`/api/installments/${loan.installments[0].id}/payments`).send({revision:loan.revision,amount:100,payment_date:today()}).expect(201)).body.loan;
  const before = await snapshot();
  await admin.patch('/api/loans/'+loan.id).send({revision:loan.revision,client_id:second.id}).expect(409);
  await admin.patch('/api/loans/'+loan.id).send({revision:loan.revision,company_id:2}).expect(409);
  await admin.patch('/api/clients/'+first.id).send({companyIds:[2]}).expect(409);
  assert.deepEqual(await snapshot(),before);
  await admin.patch('/api/clients/'+first.id).send({companyIds:[1,2]}).expect(200);
  assert.deepEqual((await a.get('/api/loans/'+loan.id).expect(200)).body.payments,loan.payments);
  assert.equal((await b.get('/api/clients/'+first.id).expect(200)).body.loans.length,0);
  await b.get('/api/loans/'+loan.id).expect(404);
  await admin.post('/api/loans').send(loanBody(first.id,2)).expect(201);
  assert.equal((await both.get('/api/clients/'+first.id).expect(200)).body.loans.length,2);
});

test('auditoria reverte cadastro/vínculos e guardas protegem atualização direta fora do escopo', async () => {
  await injectFailure({name:'fail_client_create',table:'auth_audit_logs',event:'INSERT',condition:"NEW.event='client_created'"});
  const before = await snapshot();
  await admin.post('/api/clients').send(body).expect(409);
  assert.deepEqual(await snapshot(),before);
  const id = (await database().prepare("INSERT INTO clients(name,cpf) VALUES('Antigo','52998224725')").run()).lastInsertRowid;
  await database().prepare('INSERT INTO client_companies(client_id,company_id) VALUES(?,2)').run(id);
  await withCompanyAccess({role:'user',companyIds:[1]},async () => {
    await assert.rejects(database().prepare("UPDATE clients SET name='Invadido' WHERE id=?").run(id));
    await assert.rejects(database().prepare('DELETE FROM clients WHERE id=?').run(id));
  });
  await injectFailure({name:'fail_client_edit',table:'auth_audit_logs',event:'INSERT',condition:"NEW.event='client_updated'"});
  const beforeEdit = await snapshot();
  await admin.patch('/api/clients/'+id).send({name:'Outra pessoa',companyIds:[1,2]}).expect(409);
  assert.deepEqual(await snapshot(),beforeEdit);
});
