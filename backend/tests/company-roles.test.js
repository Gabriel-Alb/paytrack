import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase, database, injectFailure } from './database-helper.js';
import { insertUser, byId } from '../src/modules/auth/auth.repository.js';
import { newSession, reviewUser } from '../src/modules/auth/auth.service.js';
import { setMembership, addRequestedCompany, requestCompanies } from '../src/modules/companies/companies.repository.js';
import { changeMembership, authorizeGlobalAdministrator } from '../src/modules/companies/companies.service.js';
import { accessEvents } from '../src/modules/auth/auth.events.js';
import { authConfig } from '../src/config/auth.js';
import { env } from '../src/config/env.js';

let admin, manager, other, member, serial;
async function account(role='user', links=[], status='active') {
  const id = await insertUser({name:`Pessoa ${++serial}`,email:`person${serial}@example.test`,cpf:null,passwordHash:'offline'},role,status);
  for (const [companyId,companyRole] of links) await setMembership(id,companyId,companyRole);
  const session = await newSession(id);
  const api = request.agent(app).set('Cookie',`${authConfig.cookieName}=${session.token}`)
    .set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',session.csrfToken);
  return {id,api,session};
}
async function applicant(companies=[1,2]) {
  const person = await account('user',[],'pending');
  for (const id of companies) await addRequestedCompany(person.id,id);
  return person;
}
const decide = (actor,person,decisions,status=200) => actor.api.patch(`/api/users/${person.id}/company-access`).send({decisions}).expect(status);
const approve = (companyId,role='USER') => ({companyId,action:'approve',role});
const reject = companyId => ({companyId,action:'reject'});
const links = id => database().prepare('SELECT company_id,role FROM user_companies WHERE user_id=? ORDER BY company_id').all(id);
beforeEach(async () => {
  await openDatabase(); serial=0;
  admin=await account('admin');
  manager=await account('user',[[1,'MANAGER'],[2,'USER']]);
  other=await account('user',[[2,'MANAGER']]);
  member=await account('user',[[1,'USER'],[2,'MANAGER']]);
});
afterEach(closeDatabase);

test('cadastro público grava múltiplas empresas pendentes sem criar vínculos ou autenticar', async () => {
  const browser=request.agent(app);
  const csrf=(await browser.get('/api/auth/csrf').expect(200)).body.csrfToken;
  const companies=(await browser.get('/api/auth/companies').expect(200)).body;
  assert.deepEqual(companies.map(row=>Object.keys(row).sort()),[['id','name'],['id','name']]);
  await browser.post('/api/auth/request-access').set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',csrf)
    .send({name:'Solicitante',email:'new@example.test',cpf:'52998224725',password:'Senha123',companyIds:[1,2]}).expect(202);
  const user=await database().prepare("SELECT * FROM users WHERE email='new@example.test'").get();
  assert.equal(user.access_status,'pending'); assert.equal(user.role,'user');
  assert.deepEqual(await links(user.id),[]);
  assert.deepEqual((await requestCompanies(user.id)).map(row=>[row.id,row.status,row.companyRole]),[[1,'pending',null],[2,'pending',null]]);
  await browser.get('/api/auth/me').expect(401);
});

for (const companyIds of [[],[1,1],[1,999],['1'],[0]]) test(`cadastro recusa empresas inválidas ${JSON.stringify(companyIds)} sem gravação parcial`,async()=>{
  const browser=request.agent(app), csrf=(await browser.get('/api/auth/csrf')).body.csrfToken;
  await browser.post('/api/auth/request-access').set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',csrf)
    .send({name:'Inválido',email:'invalid@example.test',cpf:'52998224725',password:'Senha123',companyIds}).expect(400);
  assert.equal(await database().prepare("SELECT id FROM users WHERE email='invalid@example.test'").get(),undefined);
});

test('gerente lista, conta, revisa e recebe notificações somente das empresas gerenciadas',async()=>{
  const shared=await applicant(), hidden=await applicant([2]);
  assert.deepEqual((await manager.api.get('/api/companies/managed').expect(200)).body.map(row=>row.id),[1]);
  assert.equal((await manager.api.get('/api/companies').expect(200)).body.length,2);
  const list=(await manager.api.get('/api/users?status=pending').expect(200)).body;
  assert.equal(list.total,1); assert.deepEqual(list.items.map(row=>row.id),[shared.id]);
  const detail=(await manager.api.get(`/api/users/${shared.id}`).expect(200)).body;
  assert.deepEqual(detail.requests.map(row=>row.id),[1]);
  for (const key of ['cpf','rg','cnh','password_hash']) assert.equal(key in detail,false);
  await manager.api.get(`/api/users/${hidden.id}`).expect(403);
  const notices=(await manager.api.get('/api/notifications').expect(200)).body.filter(row=>row.type==='access');
  assert.deepEqual(notices.map(row=>row.userId),[shared.id]);
  const active=(await manager.api.get(`/api/users/${member.id}`).expect(200)).body;
  assert.deepEqual(active.companyIds,[1]); assert.equal(active.companies[0].role,'USER');
  assert.deepEqual((await member.api.get('/api/auth/me')).body.user.managedCompanyIds,[2]);
});

test('aprovação parcial ativa apenas o vínculo aprovado e mantém outra empresa pendente',async()=>{
  const person=await applicant();
  await decide(manager,person,[approve(1,'MANAGER')]);
  assert.equal((await byId(person.id)).access_status,'active');
  assert.deepEqual(await links(person.id),[{company_id:1,role:'MANAGER'}]);
  assert.equal((await other.api.get('/api/users?status=pending')).body.total,1);
  assert.equal((await manager.api.get('/api/users?status=pending')).body.total,0);
  await decide(other,person,[reject(2)]);
  assert.equal((await byId(person.id)).access_status,'active');
  assert.deepEqual((await requestCompanies(person.id)).map(row=>row.status),['approved','rejected']);
  const user=(await person.api.get('/api/auth/me').expect(200)).body.user;
  assert.deepEqual(user.companyIds,[1]); assert.deepEqual(user.managedCompanyIds,[1]);
});

test('recusa parcial mantém conta pendente; recusar todas impede autenticação',async()=>{
  const person=await applicant();
  await decide(manager,person,[reject(1)]);
  assert.equal((await byId(person.id)).access_status,'pending');
  assert.equal((await manager.api.get('/api/users?status=rejected')).body.total,1);
  await decide(other,person,[reject(2)]);
  assert.equal((await byId(person.id)).access_status,'rejected');
  assert.deepEqual(await links(person.id),[]);
  await person.api.get('/api/auth/me').expect(401);
});

test('lote misto não permite aprovar empresa fora do escopo e rollback preserva todas as decisões',async()=>{
  const person=await applicant();
  await decide(manager,person,[approve(1),approve(2)],403);
  assert.deepEqual(await links(person.id),[]);
  assert.ok((await requestCompanies(person.id)).every(row=>row.status==='pending'));
  await decide(admin,person,[approve(1,'MANAGER'),reject(2)]);
  assert.deepEqual(await links(person.id),[{company_id:1,role:'MANAGER'}]);
});

test('decisões são idempotentes, recusam conflitos e não recriam vínculos removidos',async()=>{
  const person=await applicant([1]);
  await decide(manager,person,[approve(1)]);
  const before=await database().prepare('SELECT * FROM auth_audit_logs').all();
  await decide(manager,person,[approve(1)]);
  assert.deepEqual(await database().prepare('SELECT * FROM auth_audit_logs').all(),before);
  await decide(manager,person,[reject(1)],409);
  await decide(manager,person,[approve(1,'MANAGER')],409);
  await manager.api.delete(`/api/companies/1/users/${person.id}`).expect(204);
  await decide(manager,person,[approve(1)]);
  assert.deepEqual(await links(person.id),[]);
});

test('decisões concorrentes conflitantes persistem somente um resultado',async()=>{
  const person=await applicant([1]);
  const results=await Promise.all([manager.api.patch(`/api/users/${person.id}/company-access`).send({decisions:[approve(1)]}),admin.api.patch(`/api/users/${person.id}/company-access`).send({decisions:[reject(1)]})]);
  assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
  assert.equal((await database().prepare("SELECT count(*) n FROM auth_audit_logs WHERE event IN ('company_access_approved','company_access_rejected')").get()).n,1);
});

test('validação rejeita papel global, decisões duplicadas, mass assignment e empresa não solicitada',async()=>{
  const person=await applicant([1]);
  for (const decisions of [[],[approve(1,'admin')],[approve(1,'user')],[approve(1),reject(1)],[{...approve(1),actorId:other.id}],[{...reject(1),role:'USER'}]])
    await decide(admin,person,decisions,400);
  await decide(admin,person,[approve(2)],403);
  assert.deepEqual(await links(person.id),[]);
});

test('USER e MANAGER mudam apenas na empresa selecionada e valem na sessão existente',async()=>{
  await manager.api.patch(`/api/companies/1/users/${member.id}`).send({role:'MANAGER'}).expect(200);
  assert.deepEqual(await links(member.id),[{company_id:1,role:'MANAGER'},{company_id:2,role:'MANAGER'}]);
  assert.equal((await byId(member.id)).role,'user');
  assert.deepEqual((await member.api.get('/api/companies/managed')).body.map(row=>row.id),[1,2]);
  await manager.api.patch(`/api/companies/1/users/${member.id}`).send({role:'USER'}).expect(200);
  await member.api.get('/api/companies/1/users').expect(403);
  await member.api.get('/api/companies/2/users').expect(200);
  const audit=await database().prepare("SELECT * FROM auth_audit_logs WHERE event='company_role_changed' ORDER BY id DESC").get();
  assert.equal(audit.actor_id,manager.id); assert.equal(audit.subject_id,member.id);
  assert.deepEqual(JSON.parse(audit.details),{companyId:1,oldRole:'MANAGER',newRole:'USER'});
});

test('gerente não administra outra empresa, não vincula IDs arbitrários nem altera papel global',async()=>{
  await manager.api.get('/api/companies/2/users').expect(403);
  await manager.api.patch(`/api/companies/2/users/${other.id}`).send({role:'USER'}).expect(403);
  await manager.api.delete(`/api/companies/2/users/${other.id}`).expect(403);
  await manager.api.patch(`/api/companies/1/users/${other.id}`).send({role:'MANAGER'}).expect(403);
  await manager.api.delete(`/api/companies/1/users/${other.id}`).expect(403);
  await manager.api.patch(`/api/users/${member.id}/access`).send({action:'edit',role:'admin'}).expect(403);
  await manager.api.post('/api/companies').send({name:'Não permitido'}).expect(403);
  await manager.api.patch('/api/companies/1').send({name:'Não permitido'}).expect(403);
  for (const body of [{role:'admin'},{role:'USER',companyId:2},{role:'MANAGER',userId:other.id}])
    await manager.api.patch(`/api/companies/1/users/${member.id}`).send(body).expect(400);
});

test('último gerente não pode remover ou rebaixar a si; outro gerente ativo permite transferência',async()=>{
  for (const method of ['patch','delete']) {
    const result=await manager.api[method](`/api/companies/1/users/${manager.id}`).send(method==='patch'?{role:'USER'}:undefined).expect(409);
    assert.equal(result.body.error.code,'LAST_COMPANY_MANAGER');
  }
  await manager.api.patch(`/api/companies/1/users/${member.id}`).send({role:'MANAGER'}).expect(200);
  await manager.api.delete(`/api/companies/1/users/${manager.id}`).expect(204);
  await manager.api.get('/api/users').expect(403);
  await manager.api.get('/api/companies/1/users').expect(403);
  assert.deepEqual(await links(manager.id),[{company_id:2,role:'USER'}]);
});

test('gerente bloqueado não conta como substituto e administrador pode recuperar uma empresa sem gerente',async()=>{
  const blocked=await account('user',[[1,'MANAGER']],'blocked');
  await manager.api.patch(`/api/companies/1/users/${manager.id}`).send({role:'USER'}).expect(409);
  await admin.api.patch(`/api/companies/1/users/${manager.id}`).send({role:'USER'}).expect(200);
  await manager.api.get('/api/users').expect(403);
  await admin.api.patch(`/api/companies/1/users/${other.id}`).send({role:'MANAGER'}).expect(200);
  await other.api.get('/api/companies/1/users').expect(200);
  await blocked.api.get('/api/companies/1/users').expect(401);
});

test('remoção e edição global preservam níveis restantes; aprovação não desbloqueia conta',async()=>{
  const person=await applicant();
  await decide(manager,person,[approve(1,'MANAGER')]);
  await admin.api.patch(`/api/users/${person.id}/access`).send({action:'block'}).expect(200);
  await decide(other,person,[approve(2)]);
  assert.equal((await byId(person.id)).access_status,'blocked');
  await admin.api.patch(`/api/users/${person.id}/access`).send({action:'edit',role:'user',companyIds:[1,2]}).expect(200);
  assert.deepEqual(await links(person.id),[{company_id:1,role:'MANAGER'},{company_id:2,role:'USER'}]);
  await admin.api.delete(`/api/companies/2/users/${person.id}`).expect(204);
  assert.deepEqual(await links(person.id),[{company_id:1,role:'MANAGER'}]);
});

test('autorização relê o ator dentro da transação e não confia em objeto de sessão antigo',async()=>{
  const stale=await byId(manager.id);
  await admin.api.patch(`/api/companies/1/users/${manager.id}`).send({role:'USER'}).expect(200);
  await assert.rejects(changeMembership(stale,1,member.id,{role:'MANAGER'}),{code:'COMPANY_FORBIDDEN'});
  await assert.rejects(reviewUser(member.id,stale),{code:'COMPANY_FORBIDDEN'});
  const secondAdmin=await account('admin');
  const staleAdmin=await byId(secondAdmin.id);
  await admin.api.patch(`/api/users/${secondAdmin.id}/access`).send({action:'edit',role:'user',companyIds:[1]}).expect(200);
  await assert.rejects(authorizeGlobalAdministrator(staleAdmin),{code:'COMPANY_FORBIDDEN'});
  await secondAdmin.api.post('/api/companies').send({name:'Não autorizado'}).expect(403);
});

test('auditoria falha reverte decisão e papel sem emitir evento; aprovação legada emite somente após commit',async()=>{
  const person=await applicant(); let events=0;
  const listener=()=>{events++}; accessEvents.on('changed',listener);
  try {
    await injectFailure({name:'fail_company_audit',event:'INSERT',table:'auth_audit_logs',condition:"NEW.event='company_access_rejected'"});
    await decide(admin,person,[approve(1),reject(2)],409);
    assert.deepEqual(await links(person.id),[]); assert.equal(events,0);
    assert.ok((await requestCompanies(person.id)).every(row=>row.status==='pending'));
    await admin.api.patch(`/api/users/${person.id}/access`).send({action:'approve',companyIds:[1,2]}).expect(200);
    assert.equal(events,1);
    await injectFailure({name:'fail_role_audit',event:'INSERT',table:'auth_audit_logs',condition:"NEW.event='company_role_changed'"});
    await manager.api.patch(`/api/companies/1/users/${person.id}`).send({role:'MANAGER'}).expect(409);
    assert.deepEqual(await links(person.id),[{company_id:1,role:'USER'},{company_id:2,role:'USER'}]); assert.equal(events,1);
  } finally { accessEvents.off('changed',listener) }
});

test('todos os novos endpoints exigem sessão; escritas exigem CSRF; USER não recebe administração',async()=>{
  const plain=await account('user',[[1,'USER']]);
  const person=await applicant();
  for (const [method,path,body] of [
    ['get','/companies/managed'],['get','/companies/1/users'],['get','/users'],['get','/users/events'],['get',`/users/${person.id}`],
    ['patch',`/companies/1/users/${member.id}`,{role:'MANAGER'}],['delete',`/companies/1/users/${member.id}`],
    ['patch',`/users/${person.id}/company-access`,{decisions:[approve(1)]}],
  ]) {
    await request(app)[method]('/api'+path).send(body).expect(401);
    await plain.api[method]('/api'+path).send(body).expect(403);
    if (method!=='get') await request(app)[method]('/api'+path).set('Cookie',`${authConfig.cookieName}=${manager.session.token}`).set('Origin',env.FRONTEND_ORIGIN).send(body).expect(403);
  }
  for(const path of ['/companies/1/users?page=0','/companies/1/users?companyId=2','/users?companyId=2']) await manager.api.get('/api'+path).expect(400);
});

test('paginação não conta nem expõe membros de outras empresas',async()=>{
  for (let i=0;i<51;i++) {
    const id=await insertUser({name:`Paginação ${i}`,email:`page${i}@example.test`,cpf:null,passwordHash:'offline'},'user','active');
    await setMembership(id,1,'USER');
  }
  const first=(await manager.api.get('/api/companies/1/users').expect(200)).body;
  const second=(await manager.api.get('/api/companies/1/users?page=2').expect(200)).body;
  assert.equal(first.total,53); assert.equal(first.items.length,50); assert.equal(second.items.length,3);
  const ids=[...first.items,...second.items].map(row=>row.id);
  assert.equal(new Set(ids).size,53); assert.ok(!ids.includes(other.id));
});

test('constraints persistidas recusam níveis e estados incoerentes da solicitação',async()=>{
  const person=await applicant([1]);
  await assert.rejects(database().prepare("UPDATE user_companies SET role='admin' WHERE user_id=?").run(manager.id));
  await assert.rejects(database().prepare("UPDATE user_access_companies SET status='approved' WHERE user_id=?").run(person.id));
  await assert.rejects(database().prepare("UPDATE user_access_companies SET company_role='MANAGER' WHERE user_id=?").run(person.id));
  await decide(manager,person,[approve(1)]);
  await assert.rejects(database().prepare("UPDATE user_access_companies SET status='rejected' WHERE user_id=?").run(person.id));
});

test('rebaixamentos simultâneos não deixam a empresa sem gerente ativo',async()=>{
  await manager.api.patch(`/api/companies/1/users/${member.id}`).send({role:'MANAGER'}).expect(200);
  const results=await Promise.all([manager,member].map(actor=>actor.api.patch(`/api/companies/1/users/${actor.id}`).send({role:'USER'})));
  assert.deepEqual(results.map(row=>row.status).sort(),[200,409]);
  assert.equal((await database().prepare("SELECT count(*) n FROM user_companies WHERE company_id=1 AND role='MANAGER'").get()).n,1);
});

test('SSE revalida permissões e encerra conexão de gerente rebaixado',async()=>{
  const server=app.listen(0,'127.0.0.1');
  const controller=new AbortController();
  try {
    if (!server.listening) await new Promise(resolve=>server.once('listening',resolve));
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/users/events`,{
      headers:{Cookie:`${authConfig.cookieName}=${manager.session.token}`},signal:controller.signal});
    assert.equal(response.status,200);
    const reader=response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value),/data: refresh/);
    await admin.api.patch(`/api/companies/1/users/${manager.id}`).send({role:'USER'}).expect(200);
    assert.equal((await reader.read()).done,true);
  } finally {controller.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
