import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { openDatabase, closeDatabase, database } from './database-helper.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { insertUser, byId } from '../src/modules/auth/auth.repository.js';
import { setMembership } from '../src/modules/companies/companies.repository.js';

const password = 'SenhaDeTeste123';
let passwordHash;
const originalLock = env.SERVICE_LOCK_ENABLED;
beforeEach(async () => {
  await openDatabase();
  passwordHash ??= await hashPassword(password);
  env.SERVICE_LOCK_ENABLED = true;
});
afterEach(async () => {
  env.SERVICE_LOCK_ENABLED = originalLock;
  await closeDatabase();
});

async function browser() {
  const agent = request.agent(app);
  const challenge = await agent.get('/api/auth/csrf').expect(200);
  return agent.set('Origin', env.FRONTEND_ORIGIN).set('X-CSRF-Token', challenge.body.csrfToken);
}
async function account(role, membership, status = 'active') {
  const email = 'pessoa@example.test';
  const id = await insertUser({ name:'Pessoa', email, cpf:null, passwordHash }, role, status);
  if (membership) await setMembership(id, 1, membership);
  return { id, email };
}
async function login(email) {
  const agent = await browser();
  const { body } = await agent.post('/api/auth/login').send({ email, password }).expect(200);
  agent.set('X-CSRF-Token', body.csrfToken);
  return { agent, user:body.user };
}
async function expectLock(call) {
  const { body } = await call.expect(423);
  assert.equal(body.error.code, 'SERVICE_LOCKED');
  assert.doesNotMatch(JSON.stringify(body), /pagamento|cobrança|financeir/i);
}

test('visitantes e credenciais recusadas não recebem o bloqueio do sistema', async () => {
  const agent = await browser();
  for (const path of ['auth/status', 'auth/me', 'clients', 'dashboard/summary'])
    await agent.get('/api/' + path).expect(401);
  const { email } = await account('user', null, 'pending');
  const wrong = await agent.post('/api/auth/login').send({ email, password:'senhaErrada' }).expect(401);
  assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
  const pending = await agent.post('/api/auth/login').send({ email, password }).expect(403);
  assert.equal(pending.body.error.code, 'ACCESS_PENDING');
  await agent.get('/api/auth/me').expect(401);
});

for (const [label, role, membership] of [
  ['administrador', 'admin', null], ['gerente', 'user', 'MANAGER'], ['usuário', 'user', 'USER'],
]) {
  test(`sessão de ${label} recebe seu aviso e só pode sair durante o bloqueio`, async () => {
    const { email, id } = await account(role, membership);
    const { agent, user } = await login(email);
    assert.deepEqual(Object.keys(user).sort(), ['id', 'serviceLock']);
    assert.equal(user.id, id);
    assert.equal(user.serviceLock.title, role === 'admin' ? 'Pagamento não efetuado' : 'Sistema temporariamente indisponível');
    if (role !== 'admin') assert.doesNotMatch(JSON.stringify(user), /pagamento|cobrança|financeir/i);
    assert.deepEqual((await agent.get('/api/auth/me').expect(200)).body.user, user);
    assert.deepEqual((await agent.get('/api/auth/status').expect(200)).body, user);
    for (const path of ['clients', 'users', 'users/events', 'users/password-reset-requests', 'companies',
      'auth/companies', 'reports', 'loans', 'dashboard/summary', 'notifications'])
      await expectLock(agent.get('/api/' + path));
    for (const path of ['auth/change-required-password', 'auth/change-password', 'auth/logout-all',
      'auth/login', 'auth/request-access', 'auth/forgot-password', 'installments/1/payments', 'companies', 'clients'])
      await expectLock(agent.post('/api/' + path).send({}));
    await expectLock(agent.patch('/api/auth/me').send({ email:'alterado@example.test' }));
    await expectLock(agent.patch('/api/users/1/access').send({ action:'block' }));
    assert.equal((await byId(id)).email, email);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', 'inválido').expect(403);
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf.body.csrfToken).expect(200);
    await agent.get('/api/auth/me').expect(401);
  });
}

test('sessão existente acompanha ativação e desbloqueio mantendo escopo e expiração por inatividade', async () => {
  env.SERVICE_LOCK_ENABLED = false;
  const { id, email } = await account('user', 'USER');
  const { agent } = await login(email);
  const before = (await agent.get('/api/auth/me').expect(200)).body;
  await agent.get('/api/clients').expect(200);
  env.SERVICE_LOCK_ENABLED = true;
  await expectLock(agent.get('/api/clients'));
  const lastSeen = Date.now() - 120000;
  await database().prepare('UPDATE auth_sessions SET last_seen_at=? WHERE user_id=?').run(lastSeen, id);
  await agent.get('/api/auth/status').expect(200);
  assert.equal((await database().prepare('SELECT last_seen_at FROM auth_sessions WHERE user_id=?').get(id)).last_seen_at, lastSeen);
  env.SERVICE_LOCK_ENABLED = false;
  assert.equal((await agent.get('/api/auth/status').expect(200)).body.serviceLock, null);
  assert.deepEqual((await agent.get('/api/auth/me').expect(200)).body, before);
  await agent.get('/api/clients').expect(200);
  await agent.get('/api/users/password-reset-requests').expect(403);
});

test('bloqueio precede a troca obrigatória de senha e o desbloqueio restaura a restrição original', async () => {
  const { id, email } = await account('admin');
  await database().prepare('UPDATE users SET must_change_password=1, temporary_password_expires_at=? WHERE id=?')
    .run(Date.now() + 600000, id);
  const { agent, user } = await login(email);
  assert.equal(user.serviceLock.title, 'Pagamento não efetuado');
  await expectLock(agent.post('/api/auth/change-required-password').send({ newPassword:'NovaSenha123' }));
  env.SERVICE_LOCK_ENABLED = false;
  assert.equal((await agent.get('/api/auth/me').expect(200)).body.user.mustChangePassword, true);
  const denied = await agent.get('/api/clients').expect(403);
  assert.equal(denied.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
});
