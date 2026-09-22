import { beforeEach, afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase, closeDatabase, database, injectFailure } from './database-helper.js';
import * as auth from '../src/modules/auth/auth.repository.js';
import { hashPassword, verifyPassword } from '../src/modules/auth/auth.service.js';
import { setMembership } from '../src/modules/companies/companies.repository.js';
import { env } from '../src/config/env.js';
import { authConfig } from '../src/config/auth.js';

const password = 'SenhaOriginal123';
let adminId, userId;
beforeEach(async () => {
  await openDatabase();
  const passwordHash = await hashPassword(password);
  adminId = await auth.insertUser({name:'Administrador',email:'admin@example.test',cpf:null,passwordHash},'admin','active');
  userId = await auth.insertUser({name:'Pessoa',email:'person@example.test',cpf:null,passwordHash},'user','active');
  await setMembership(userId,1,'USER');
});
afterEach(async () => { mock.restoreAll(); await closeDatabase(); });
async function browser() {
  const agent = request.agent(app);
  const {body} = await agent.get('/api/auth/csrf').expect(200);
  return agent.set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',body.csrfToken);
}
async function login(email='admin@example.test',secret=password,status=200) {
  const agent = await browser();
  const result = await agent.post('/api/auth/login').send({email,password:secret}).expect(status);
  if (status===200) agent.set('X-CSRF-Token',result.body.csrfToken);
  return {agent,result};
}
const rows = () => database().prepare('SELECT * FROM password_reset_requests ORDER BY id').all();
async function create(email='person@example.test') {
  const agent = await browser();
  return agent.post('/api/auth/forgot-password').send({email}).expect(202);
}
async function approve() {
  await create();
  const {agent} = await login();
  const [{id}] = await rows();
  const result = await agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(200);
  return {agent,id,...result.body};
}

test('resposta pública idêntica para conta válida, inexistente, pendente, rejeitada, bloqueada e sem empresa; normaliza e deduplica', async () => {
  const first = await create(' PERSON@EXAMPLE.TEST ');
  await create();
  assert.equal((await rows()).length,1);
  assert.deepEqual(first.body,(await create('absent@example.test')).body);
  for (const status of ['pending','rejected','blocked']) {
    await database().prepare('UPDATE users SET access_status=? WHERE id=?').run(status,userId);
    await database().exec('DELETE FROM auth_rate_limits');
    assert.deepEqual(first.body,(await create()).body);
  }
  await database().prepare("UPDATE users SET access_status='active' WHERE id=?").run(userId);
  await database().prepare('DELETE FROM user_companies WHERE user_id=?').run(userId);
  await database().exec('DELETE FROM auth_rate_limits; DELETE FROM password_reset_requests');
  assert.deepEqual(first.body,(await create()).body);
  assert.equal((await rows()).length,0);
  assert.deepEqual(Object.keys(first.body),['message']);
  assert.equal((await auth.byId(userId)).password_hash.startsWith('$argon2id$'),true);
});

test('CSRF, origem, validação e mass assignment continuam protegidos', async () => {
  await request(app).post('/api/auth/forgot-password').set('Origin',env.FRONTEND_ORIGIN).send({email:'person@example.test'}).expect(403);
  const agent = await browser();
  await agent.post('/api/auth/forgot-password').set('Origin','https://evil.example').send({email:'person@example.test'}).expect(403);
  for (const body of [{email:'inválido'},{email:'person@example.test',userId:adminId},{email:'person@example.test',role:'admin'},{email:'person@example.test',companyId:2}]) {
    await database().exec('DELETE FROM auth_rate_limits');
    await agent.post('/api/auth/forgot-password').send(body).expect(400);
  }
  assert.equal((await rows()).length,0);
});

test('rate limit específico por conta e por IP não depende da existência da conta', async () => {
  const agent = await browser();
  for (let n=0;n<authConfig.limits.requestAccount;n++) await agent.post('/api/auth/forgot-password').send({email:'absent@example.test'}).expect(202);
  await agent.post('/api/auth/forgot-password').send({email:' ABSENT@example.test '}).expect(429);
  await database().exec('DELETE FROM auth_rate_limits');
  for (let n=0;n<env.AUTH_REQUEST_IP_LIMIT;n++) await agent.post('/api/auth/forgot-password').send({email:`absent${n}@example.test`}).expect(202);
  await agent.post('/api/auth/forgot-password').send({email:'another@example.test'}).expect(429);
});

test('usuário e gerente empresarial não listam nem resolvem recuperações globais', async () => {
  await create();
  const [{id}] = await rows();
  const {agent} = await login('person@example.test');
  for (const role of ['USER','MANAGER']) {
    await setMembership(userId,1,role);
    await agent.get('/api/users/password-reset-requests').expect(403);
    for (const action of ['approve','reject']) await agent.post(`/api/users/password-reset-requests/${id}/${action}`).send({}).expect(403);
    assert.ok(!(await agent.get('/api/notifications').expect(200)).body.some(item => item.type==='recovery'));
  }
  assert.equal((await rows())[0].status,'pending');
});

test('aprovação gera segredo Argon2id de uso temporário, revoga sessões e não permite consultar nem reutilizar solicitação', async () => {
  const prior = await login('person@example.test');
  const {agent,id,temporaryPassword,expiresAt} = await approve();
  assert.equal(temporaryPassword.length,20);
  assert.ok(expiresAt>Date.now() && expiresAt<=Date.now()+authConfig.temporaryPasswordMs);
  const user = await auth.byId(userId);
  assert.equal(user.must_change_password,1);
  assert.ok(await verifyPassword(user.password_hash,temporaryPassword));
  assert.ok(!await verifyPassword(user.password_hash,password));
  await prior.agent.get('/api/auth/me').expect(401);
  const completed = (await agent.get('/api/users/password-reset-requests?status=completed').expect(200)).body.items[0];
  assert.equal(completed.resolvedBy,adminId); assert.ok(completed.resolvedAt); assert.equal(completed.status,'completed');
  for (const action of ['approve','reject']) await agent.post(`/api/users/password-reset-requests/${id}/${action}`).send({}).expect(409);
  await agent.get(`/api/users/password-reset-requests/${id}`).expect(404);
  const snapshots = [...await rows(),...await database().prepare('SELECT * FROM auth_audit_logs').all(),...await database().prepare('SELECT * FROM users').all()];
  assert.ok(!JSON.stringify(snapshots).includes(temporaryPassword));
  for (const path of ['/api/users/password-reset-requests?status=completed','/api/users?status=active',`/api/users/${userId}`,'/api/notifications']) {
    const response = await agent.get(path).expect(200);
    assert.ok(!JSON.stringify(response.body).includes(temporaryPassword));
    assert.ok(!JSON.stringify(response.body).includes(user.password_hash));
  }
});

test('login temporário só permite me, CSRF, sair e troca obrigatória; conclusão troca sessão e invalida senha e pendências', async () => {
  const {temporaryPassword} = await approve();
  const {agent,result} = await login('person@example.test',temporaryPassword);
  assert.equal(result.body.user.mustChangePassword,true);
  assert.deepEqual(Object.keys(result.body.user).sort(),['email','id','mustChangePassword','name']);
  const restrictedCookie = result.headers['set-cookie'][0].split(';')[0];
  await agent.get('/api/auth/me').expect(200);
  await agent.get('/api/auth/csrf').expect(200);
  for (const path of ['/api/clients','/api/loans','/api/companies','/api/notifications','/api/users','/api/users/events','/api/dashboard/summary']) {
    const denied = await agent.get(path).expect(403);
    assert.equal(denied.body.error.code,'PASSWORD_CHANGE_REQUIRED');
  }
  await agent.patch('/api/auth/me').send({email:'changed@example.test'}).expect(403);
  await agent.post('/api/auth/change-password').send({currentPassword:temporaryPassword,newPassword:'NovaSenha123'}).expect(403);
  await agent.post('/api/auth/change-required-password').send({newPassword:temporaryPassword}).expect(400);
  await agent.post('/api/auth/change-required-password').send({newPassword:'short'}).expect(400);
  await create();
  const changed = await agent.post('/api/auth/change-required-password').send({newPassword:'NovaSenha123'}).expect(200);
  assert.ok(!changed.body.user.mustChangePassword);
  assert.notEqual(changed.headers['set-cookie'][0].split(';')[0],restrictedCookie);
  assert.notEqual(changed.body.csrfToken,result.body.csrfToken);
  agent.set('X-CSRF-Token',changed.body.csrfToken);
  await agent.get('/api/clients').expect(200);
  await request(app).get('/api/auth/me').set('Cookie',restrictedCookie).expect(401);
  const user = await auth.byId(userId);
  assert.equal(user.must_change_password,0); assert.equal(user.temporary_password_expires_at,null);
  assert.ok(!(await rows()).some(row => row.status==='pending'));
  await login('person@example.test',temporaryPassword,401);
  await login('person@example.test','NovaSenha123');
  await agent.post('/api/auth/change-required-password').send({newPassword:'OutraSenha123'}).expect(409);
});

test('senha temporária expirada invalida também a sessão restrita; conta bloqueada não completa troca', async () => {
  const {temporaryPassword} = await approve();
  const {agent} = await login('person@example.test',temporaryPassword);
  await database().prepare('UPDATE users SET temporary_password_expires_at=1 WHERE id=?').run(userId);
  await agent.get('/api/auth/me').expect(401);
  await agent.post('/api/auth/change-required-password').send({newPassword:'NovaSenha123'}).expect(401);
  await login('person@example.test',temporaryPassword,401);
  await database().prepare("UPDATE users SET temporary_password_expires_at=?,access_status='blocked' WHERE id=?").run(Date.now()+60000,userId);
  await agent.post('/api/auth/change-required-password').send({newPassword:'NovaSenha123'}).expect(401);
});

test('recuperação rejeitada e expirada não podem ser aprovadas; conta bloqueada não recebe senha', async () => {
  await create();
  const {agent} = await login();
  const [{id}] = await rows();
  await database().prepare("UPDATE users SET access_status='blocked' WHERE id=?").run(userId);
  await agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(409);
  await agent.post(`/api/users/password-reset-requests/${id}/reject`).send({}).expect(200);
  await agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(409);
  const rejected = (await rows())[0];
  assert.equal(rejected.status,'rejected');assert.equal(rejected.resolved_by,adminId);
  await database().prepare("UPDATE users SET access_status='active' WHERE id=?").run(userId);
  await create();
  const pending = (await rows())[1];
  await database().prepare('UPDATE password_reset_requests SET expires_at=1 WHERE id=?').run(pending.id);
  await agent.post(`/api/users/password-reset-requests/${pending.id}/approve`).send({}).expect(409);
  const expired = await agent.get('/api/users/password-reset-requests?status=expired').expect(200);
  assert.equal(expired.body.items[0].id,pending.id);
  await create();
  assert.equal((await rows()).filter(row => row.status==='pending').length,1);
});

test('auditoria e notificações registram responsáveis sem senhas, hashes ou dados secretos; nenhuma senha em logs', async () => {
  const logs = [];
  for (const method of ['log','warn','error']) mock.method(console,method,(...args) => logs.push(args));
  await create();
  const {agent} = await login();
  const notifications = (await agent.get('/api/notifications').expect(200)).body;
  assert.equal(notifications.filter(item => item.type==='recovery').length,1);
  const [{id}] = await rows();
  const approved = await agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(200);
  const {temporaryPassword} = approved.body;
  const person = await login('person@example.test',temporaryPassword);
  await person.agent.post('/api/auth/change-required-password').send({newPassword:'NovaSenha123'}).expect(200);
  const audit = await database().prepare('SELECT * FROM auth_audit_logs').all();
  for (const [event,actor] of [['password_recovery_requested',null],['password_recovery_approved',adminId],['password_reset_by_admin',adminId],['required_password_changed',userId]]) {
    const entry = audit.find(item => item.event===event);
    assert.equal(entry.actor_id,actor); assert.equal(entry.subject_id,userId);
  }
  const output = JSON.stringify({audit,notifications,logs});
  for (const secret of [temporaryPassword,password,'NovaSenha123','$argon2id$']) assert.ok(!output.includes(secret));
});

test('aprovações concorrentes só geram uma senha; nova recuperação invalida senha e sessão temporárias anteriores', async () => {
  const first = await approve();
  const prior = await login('person@example.test',first.temporaryPassword);
  await create();
  const id = (await rows()).at(-1).id;
  const results = await Promise.all([1,2].map(() => first.agent.post(`/api/users/password-reset-requests/${id}/approve`).send({})));
  assert.deepEqual(results.map(row => row.status).sort(),[200,409]);
  const second = results.find(row => row.status===200).body.temporaryPassword;
  assert.notEqual(second,first.temporaryPassword);
  await prior.agent.get('/api/auth/me').expect(401);
  await login('person@example.test',first.temporaryPassword,401);
  await login('person@example.test',second);
});

test('falha na auditoria reverte hash, resolução e revogação de sessão', async () => {
  await create();
  const original = await auth.byId(userId);
  const prior = await login('person@example.test');
  const {agent} = await login();
  await injectFailure({name:'fail_recovery_audit',event:'INSERT',table:'auth_audit_logs',condition:"NEW.event='password_reset_by_admin'"});
  const [{id}] = await rows();
  await agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(409);
  assert.equal((await rows())[0].status,'pending');
  assert.equal((await auth.byId(userId)).password_hash,original.password_hash);
  await prior.agent.get('/api/auth/me').expect(200);
});

test('brute force da senha temporária mantém o rate limit do login e a saída restrita funciona', async () => {
  const {temporaryPassword} = await approve();
  const {agent} = await login('person@example.test',temporaryPassword);
  await agent.post('/api/auth/logout').expect(200);
  await agent.get('/api/auth/me').expect(401);
  await database().exec('DELETE FROM auth_rate_limits');
  for (let n=0;n<env.AUTH_LOGIN_ACCOUNT_LIMIT;n++) await login('person@example.test','SenhaErrada123',401);
  await login('person@example.test',temporaryPassword,429);
});

test('administrador bloqueado perde autorização; rejeição é auditada e autoaprovação é recusada', async () => {
  await create('admin@example.test');
  const {agent} = await login();
  const [{id}] = await rows();
  await agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(409);
  await agent.post(`/api/users/password-reset-requests/${id}/reject`).send({}).expect(200);
  const event = await database().prepare("SELECT * FROM auth_audit_logs WHERE event='password_recovery_rejected'").get();
  assert.equal(event.actor_id,adminId); assert.equal(event.subject_id,adminId);
  await auth.insertUser({name:'Outro admin',email:'other@example.test',cpf:null,passwordHash:await hashPassword(password)},'admin','active');
  await database().prepare("UPDATE users SET access_status='blocked' WHERE id=?").run(adminId);
  await agent.get('/api/users/password-reset-requests').expect(401);
  await agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(401);
});

test('troca normal preservada invalida solicitações pendentes; troca obrigatória concorrente só conclui uma vez', async () => {
  await create();
  const normal = await login('person@example.test');
  await normal.agent.post('/api/auth/change-password').send({currentPassword:password,newPassword:'NormalNova123'}).expect(200);
  assert.equal((await rows())[0].status,'expired');
  const admin = await login();
  await create();
  const id = (await rows()).at(-1).id;
  const approved = await admin.agent.post(`/api/users/password-reset-requests/${id}/approve`).send({}).expect(200);
  const restricted = await login('person@example.test',approved.body.temporaryPassword);
  const responses = await Promise.all([1,2].map(n => restricted.agent.post('/api/auth/change-required-password').send({newPassword:`NovaSenha${n}23`})));
  assert.deepEqual(responses.map(row => row.status).sort(),[200,401]);
  assert.equal((await database().prepare("SELECT count(*) n FROM auth_audit_logs WHERE event='required_password_changed'").get()).n,1);
});
