import { injectFailure } from './database-helper.js';
import { beforeEach,afterEach,test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase,closeDatabase,database } from './database-helper.js';
import { env,backendRoot } from '../src/config/env.js';
import { authConfig } from '../src/config/auth.js';
import { createMaster,hashPassword,hashToken,verifyPassword } from '../src/modules/auth/auth.service.js';
import { passwordSchema } from '../src/modules/auth/auth.validator.js';
import * as repo from '../src/modules/auth/auth.repository.js';
import { errorHandler } from '../src/shared/middleware/errors.js';
import { networkInterfaces } from 'node:os';
import { accessEvents } from '../src/modules/auth/auth.events.js';

let password,master;
const data = () => ({name:'Pessoa teste',email:'person@example.test',cpf:'529.982.247-25',rg:'12.345-x',cnh:'12345678901',password});
beforeEach(async()=>{
  (await openDatabase(':memory:'));
  password=randomBytes(15).toString('base64url');
  master=await createMaster({name:'Master teste',email:'master@example.test',cpf:'11144477735',password});
});
afterEach(async ()=>{mock.restoreAll();(await closeDatabase())});
async function browser() {
  const agent=request.agent(app);
  const csrf=await agent.get('/api/auth/csrf').expect(200);
  agent.set('Origin',env.FRONTEND_ORIGIN).set('X-CSRF-Token',csrf.body.csrfToken);
  return {agent,csrf:csrf.body.csrfToken,cookie:csrf.headers['set-cookie'][0].split(';')[0]};
}
async function signIn(email='master@example.test',secret=password,status=200) {
  const context=await browser();
  const result=await context.agent.post('/api/auth/login').send({email,password:secret}).expect(status);
  if (status===200) context.agent.set('X-CSRF-Token',result.body.csrfToken);
  return {...context,result};
}
async function user(status='pending',overrides={}) {
  const input={...data(),...overrides};
  const id=(await repo.insertUser({...input,cpf:input.cpf.replace(/\D/g,''),rg:input.rg.replace(/[^a-z\d]/gi,'').toUpperCase(),passwordHash:await hashPassword(input.password)},'user',status));
  return (await repo.byId(id));
}
const count=async ()=>(await database().prepare('SELECT count(*) n FROM users').get()).n;

test('assinante com falha não transforma cadastro persistido ou aprovação em erro, nem impede outros assinantes', async () => {
  const admin = await signIn(), visitor = await browser();
  const failing = () => { throw new Error('Conexão interrompida'); };
  let received = 0;
  const healthy = () => { received++; };
  mock.method(console, 'error', () => {});
  accessEvents.on('changed', failing);
  accessEvents.on('changed', healthy);
  try {
    await visitor.agent.post('/api/auth/request-access').send({...data(),rg:'',cnh:''}).expect(202);
    const saved = (await repo.byEmail(data().email));
    assert.equal(saved.access_status, 'pending');
    assert.equal(saved.rg, null);
    assert.equal(saved.cnh, null);
    assert.equal(received, 1);
    assert.equal((await admin.agent.get('/api/users?status=pending').expect(200)).body.items[0].id, saved.id);
    await admin.agent.patch(`/api/users/${saved.id}/access`).send({action:'approve',role:'user',companyIds:[1]}).expect(200);
    assert.equal(received, 2);
    assert.equal((await repo.byId(saved.id)).access_status, 'active');
    assert.deepEqual((await database().prepare('SELECT company_id FROM user_companies WHERE user_id=?').all(saved.id)), [{company_id:1}]);
    await signIn(data().email);
  } finally {
    accessEvents.off('changed', failing);
    accessEvents.off('changed', healthy);
  }
});

test('cadastro explica validação sem expor valores, não grava falhas e aceita correção na mesma sessão', async () => {
  const {agent} = await browser();
  const invalid = await agent.post('/api/auth/request-access').send({...data(),cpf:'11111111111'}).expect(400);
  assert.equal(invalid.body.error.message, 'Informe um CPF válido.');
  assert.ok(!JSON.stringify(invalid.body).includes('11111111111'));
  assert.equal((await count()), 1);
  await agent.post('/api/auth/request-access').send(data()).expect(202);
  await agent.post('/api/auth/request-access').send(data()).expect(409);
  assert.equal((await count()), 2);
  assert.equal((await database().prepare("SELECT count(*) n FROM auth_audit_logs WHERE event='access_requested'").get()).n, 1);
});

test('pré-cadastro normaliza documentos/e-mail, persiste Argon2id e não autentica',async()=>{
  const {agent}=await browser();
  const result=await agent.post('/api/auth/request-access').send({...data(),email:' PERSON@EXAMPLE.TEST '}).expect(202);
  const saved=(await repo.byEmail('person@example.test'));
  assert.equal(saved.role,'user');assert.equal(saved.access_status,'pending');
  assert.equal(saved.cpf,'52998224725');assert.equal(saved.rg,'12345X');
  assert.ok(saved.password_hash.startsWith('$argon2id$v=19$'));
  assert.deepEqual(saved.password_hash.split('$')[3].split(',').sort(),['m=19456','p=1','t=2']);
  assert.ok(await verifyPassword(saved.password_hash,password));
  assert.ok(!JSON.stringify(saved).includes(password));
  assert.deepEqual(Object.keys(result.body),['message']);
  await agent.get('/api/auth/me').expect(401);
  assert.equal((await database().prepare('SELECT count(*) n FROM auth_sessions WHERE user_id IS NOT NULL').get()).n,0);
  assert.equal((await database().prepare("SELECT count(*) n FROM auth_audit_logs WHERE event='access_requested'").get()).n,1);
});

for (const length of [5,6,20,21]) test(`senha de ${length} caracteres em cadastro, login, troca e master`,async()=>{
  const secret='x'.repeat(length),valid=length>=6 && length<=20;
  const {agent}=await browser();
  await agent.post('/api/auth/request-access').send({...data(),password:secret}).expect(valid ? 202 : 400);
  await agent.post('/api/auth/login').send({email:data().email,password:secret}).expect(valid ? 403 : 400);
  const admin=await signIn();
  await admin.agent.post('/api/auth/change-password').send({currentPassword:password,newPassword:secret}).expect(valid ? 200 : 400);
  await assert.rejects((async () => await createMaster({...data(),password:secret})),valid ? {code:'MASTER_EXISTS'} : {name:'ZodError'});
});

test('solicitação pela API aparece na lista do master e emite evento após commit; aprovação/rejeição atualizam as listas',async()=>{
  const admin=await signIn(),visitor=await browser();
  const before=(await admin.agent.get('/api/users?status=pending').expect(200)).body;
  assert.equal(before.total,0);
  const server=app.listen(0,'127.0.0.1');
  await new Promise((resolve)=>server.once('listening',resolve));
  const abort=new AbortController();
  try {
    const stream=await fetch(`http://127.0.0.1:${server.address().port}/api/users/events`,{
      headers:{Cookie:admin.result.headers['set-cookie'][0].split(';')[0],Origin:env.FRONTEND_ORIGIN},signal:abort.signal,
    });
    assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
    const reader=stream.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value),/data: refresh/);
    for (const action of ['approve','reject']) {
      const input=action==='approve' ? data() : {...data(),email:'other@example.test',cpf:'12345678909',rg:'',cnh:''};
      await visitor.agent.post('/api/auth/request-access').send(input).expect(202);
      const notification=await reader.read();
      assert.match(new TextDecoder().decode(notification.value),/data: refresh/);
      const list=(await admin.agent.get('/api/users?status=pending').expect(200)).body;
      assert.equal(list.total,1);assert.equal(list.items[0].email,input.email);
      const saved=(await repo.byEmail(input.email));
      assert.equal(saved.access_status,'pending');
      await admin.agent.patch(`/api/users/${saved.id}/access`).send(action==='approve' ? {action,role:'user',companyIds:[1]} : {action}).expect(200);
      assert.match(new TextDecoder().decode((await reader.read()).value),/data: refresh/);
      assert.equal((await admin.agent.get('/api/users?status=pending').expect(200)).body.total,0);
      const status=action==='approve' ? 'active' : 'rejected';
      assert.ok((await admin.agent.get(`/api/users?status=${status}`).expect(200)).body.items.some(({id})=>id===saved.id));
      await signIn(input.email,password,action==='approve' ? 200 : 403);
    }
    await admin.agent.post('/api/auth/logout').expect(200);
    accessEvents.emit('changed');
    assert.equal((await reader.read()).done,true);
  } finally {
    abort.abort();server.closeAllConnections();
    await new Promise((resolve)=>server.close(resolve));
  }
  assert.equal(accessEvents.listenerCount('changed'),0);
});

test('origens locais usam a mesma política no CORS, preflight, Referer e escritas com CSRF',async()=>{
  const hosts=['localhost','127.0.0.1',...Object.values(networkInterfaces()).flat().filter((entry)=>entry.family==='IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)).map(({address})=>address)];
  for (const host of new Set(env.NODE_ENV === 'development' ? hosts : [new URL(env.FRONTEND_ORIGIN).hostname])) {
    const origin=new URL(env.FRONTEND_ORIGIN);origin.hostname=host;
    const agent=request.agent(app);
    const preflight=await agent.options('/api/auth/login').set('Origin',origin.origin).set('Access-Control-Request-Method','POST').expect(204);
    assert.equal(preflight.headers['access-control-allow-origin'],origin.origin);
    const csrf=await agent.get('/api/auth/csrf').set('Origin',origin.origin).expect(200);
    assert.equal(csrf.headers['access-control-allow-origin'],origin.origin);
    const login=await agent.post('/api/auth/login').set('Origin',origin.origin).set('X-CSRF-Token',csrf.body.csrfToken).send({email:'master@example.test',password}).expect(200);
    await agent.get('/api/users').set('Referer',`${origin.origin}/users`).expect(200);
    await agent.post('/api/auth/logout').set('Origin',origin.origin).set('X-CSRF-Token',login.body.csrfToken).expect(200);
  }
  for (const origin of ['http://localhost:9999','http://192.168.255.254:5173','http://localhost.evil.example:5173','null']) {
    const denied=await request(app).get('/api/auth/csrf').set('Origin',origin).expect(403);
    assert.equal(denied.headers['access-control-allow-origin'],undefined);
  }
});
test('Argon2id usa salts diferentes por senha e verifica sem truncamento',async()=>{
  const long='😀'.repeat(10);
  const first=await hashPassword(long),second=await hashPassword(long);
  assert.ok(first!==second);assert.ok(first.split('$')[4]!==second.split('$')[4]);
  assert.ok(Buffer.from(first.split('$')[4],'base64').length>=16);
  assert.ok(await verifyPassword(first,long));assert.ok(!await verifyPassword(first,long.slice(0,-2)));
});
for (const field of ['role','access_status','approved_by','password_hash'])
  test(`cadastro rejeita mass assignment de ${field}`,async()=>{
    const {agent}=await browser();
    await agent.post('/api/auth/request-access').send({...data(),[field]:field==='role'?'master':'active'}).expect(400);
    assert.equal((await count()),1);
  });
test('valida CPF, email, tipo, comprimento e payload; permite espaços e Unicode',async()=>{
  assert.equal(passwordSchema.parse('😀'.repeat(10)),'😀'.repeat(10));
  assert.equal(passwordSchema.parse('frase com espaços'), 'frase com espaços');
  assert.throws(()=>passwordSchema.parse('x'.repeat(21)));
  for(const change of [{cpf:'11111111111'},{email:'bad'},{password:'curta'},{password:15}]) {
    const {agent}=await browser();
    await agent.post('/api/auth/request-access').send({...data(),...change}).expect(400);
  }
  const {agent}=await browser();
  await agent.post('/api/auth/login').send({email:'a'.repeat(140000),password}).expect(400);
});
for(const key of ['email','cpf','rg','cnh'])
  test(`duplicidade de ${key} informa falha sem identificar o campo em conflito`,async()=>{
    const {agent}=await browser();
    await agent.post('/api/auth/request-access').send(data()).expect(202);
    const second={...data(),email:'other@example.test',cpf:'12345678909',rg:'54321X',cnh:'10987654321',[key]:key==='email'?'PERSON@EXAMPLE.TEST':data()[key]};
    const result=await agent.post('/api/auth/request-access').send(second).expect(409);
    assert.equal(result.body.error.code,'ACCESS_REQUEST_CONFLICT');assert.equal((await count()),2);
    assert.equal((await repo.byEmail('other@example.test')),undefined);
  });
for(const status of ['pending','rejected','blocked'])
  test(`${status} não recebe sessão, estado só é revelado após senha correta`,async()=>{
    await user(status);
    const denied=await signIn('person@example.test',password,403);
    assert.equal(denied.result.body.error.code,`ACCESS_${status.toUpperCase()}`);
    assert.equal(denied.result.headers['set-cookie'],undefined);
    const invalid=await signIn('person@example.test','incorreta',401);
    assert.equal(invalid.result.body.error.code,'INVALID_CREDENTIALS');
  });
test('login ativo gera cookie novo opaco; banco só contém hash e API minimiza dados',async()=>{
  await user('active');
  const {agent,result,cookie:anonymous}=await signIn('person@example.test');
  const cookie=result.headers['set-cookie'][0];
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Path=\//);
  const raw=cookie.split(';')[0].split('=')[1];
  assert.equal(Buffer.from(raw,'base64url').length,32);
  const session=(await repo.sessionByHash(hashToken(raw)));
  assert.ok(session.user_id);assert.notEqual(session.token_hash,raw);
  assert.ok(!JSON.stringify((await database().prepare('SELECT * FROM auth_sessions').all())).includes(raw));
  assert.ok(!JSON.stringify(result.body).includes(raw));
  assert.notEqual(cookie.split(';')[0],anonymous);
  const me=await agent.get('/api/auth/me').expect(200);
  assert.deepEqual(Object.keys(me.body.user).sort(),['accessStatus','companies','companyIds','cpf','email','id','name','rg','role']);
  await request(app).get('/api/auth/me').set('Cookie',anonymous).expect(401);
});
test('senha incorreta, inexistente e email de SQL injection não autenticam',async()=>{
  await user('active');
  const bad=await signIn('person@example.test','errada',401);
  const absent=await signIn('missing@example.test','errada',401);
  assert.deepEqual(bad.result.body,absent.result.body);
  const {agent}=await browser();
  await agent.post('/api/auth/login').send({email:"' OR 1=1 --",password}).expect(400);
  await agent.post('/api/auth/login').send({email:"'or'1'='1@example.test",password}).expect(400);
  await agent.post('/api/auth/login').send({email:'person@example.test',password:"' OR 1=1 --"}).expect(401);
  assert.equal((await count()),2);
});
test('rate limit por conta soma IPs e sobrevive a novos agentes',async()=>{
  for(let n=0;n<env.AUTH_LOGIN_ACCOUNT_LIMIT;n++) await signIn('missing@example.test','errada',401);
  const {result}=await signIn('MISSING@EXAMPLE.TEST','errada',429);
  assert.equal(result.body.error.code,'TOO_MANY_ATTEMPTS');
  assert.equal(result.headers['x-ratelimit-remaining'],undefined);
});
test('rate limit por IP bloqueia emails variados e não confia em X-Forwarded-For',async()=>{
  const {agent}=await browser();
  for(let n=0;n<env.AUTH_LOGIN_IP_LIMIT;n++)
    await agent.post('/api/auth/login').set('X-Forwarded-For',`198.51.100.${n+1}`).send({email:`test${n}@example.test`,password:'errada'}).expect(401);
  await agent.post('/api/auth/login').send({email:'new@example.test',password:'errada'}).expect(429);
});
test('limita solicitação de acesso',async()=>{
  const {agent}=await browser();
  for(let n=0;n<env.AUTH_REQUEST_IP_LIMIT;n++) await agent.post('/api/auth/request-access').send({...data(),email:`test${n}@example.test`}).expect(n===0 ? 202 : 409);
  await agent.post('/api/auth/request-access').send({...data(),email:'new@example.test'}).expect(429);
  (await database().exec('UPDATE auth_rate_limits SET reset_at=1'));
  await agent.post('/api/auth/request-access').send({...data(),email:'new@example.test'}).expect(409);
});
test('login pode ser tentado novamente após janela, sem bloqueio permanente',async()=>{
  for(let n=0;n<env.AUTH_LOGIN_ACCOUNT_LIMIT;n++)await signIn('master@example.test','errada',401);
  await signIn('master@example.test',password,429);
  (await database().exec('UPDATE auth_rate_limits SET reset_at=1'));
  await signIn();
});
for(const method of ['post','put','patch','delete'])test(`CSRF protege ${method.toUpperCase()} autenticado`,async()=>{
  const {agent}=await signIn();
  await agent[method]('/api/clients/1').set('X-CSRF-Token','invalid').send({}).expect(403);
});
test('logout revoga token no servidor; logout-all revoga todas as sessões',async()=>{
  const first=await signIn();
  const old=first.result.headers['set-cookie'][0].split(';')[0];
  const logout=await first.agent.post('/api/auth/logout').expect(200);
  assert.match(logout.headers['set-cookie'][0],/Expires=Thu, 01 Jan 1970/);
  await request(app).get('/api/auth/me').set('Cookie',old).expect(401);
  const second=await signIn(),third=await signIn();
  await second.agent.post('/api/auth/logout-all').expect(200);
  await third.agent.get('/api/auth/me').expect(401);
});
for(const reason of ['absolute','idle','revoked'])
  test(`sessão ${reason} é recusada`,async()=>{
    const {agent}=await signIn();
    const sql={absolute:'UPDATE auth_sessions SET expires_at=1',idle:'UPDATE auth_sessions SET last_seen_at=1',revoked:'UPDATE auth_sessions SET revoked_at=1'}[reason];
    (await database().exec(sql));
    await agent.get('/api/auth/me').expect(401);
  });
test('usuário comum não lista, avalia, aprova a si mesmo nem altera role',async()=>{
  const person=await user('active');
  const {agent}=await signIn(person.email);
  await agent.get('/api/users').expect(403);
  await agent.get('/api/users/events').expect(403);
  await agent.get(`/api/users/${person.id}`).expect(403);
  await agent.patch(`/api/users/${person.id}/access`).send({action:'approve',role:'master'}).expect(403);
  assert.equal((await repo.byId(person.id)).role,'user');
});

test('perfil lê documentos reais, salva só o próprio email e mantém troca de senha e login',async()=>{
  const person=await user('active');
  const {agent}=await signIn(person.email);
  const original=(await agent.get('/api/auth/me').expect(200)).body.user;
  assert.equal(original.cpf,person.cpf);assert.equal(original.rg,person.rg);
  const saved=(await agent.patch('/api/auth/me').send({email:' UPDATED@EXAMPLE.TEST '}).expect(200)).body.user;
  assert.equal(saved.email,'updated@example.test');assert.equal(saved.id,person.id);
  assert.equal(saved.cpf,person.cpf);assert.equal(saved.rg,person.rg);assert.equal(saved.role,'user');
  assert.equal((await repo.byId(person.id)).email,saved.email);assert.equal((await repo.byId(master.id)).email,master.email);
  assert.equal((await agent.get('/api/auth/me').expect(200)).body.user.email,saved.email);
  await signIn(person.email,password,401);
  const second=await signIn(saved.email);
  const next=randomBytes(15).toString('base64url');
  await agent.post('/api/auth/change-password').send({currentPassword:password,newPassword:next}).expect(200);
  await second.agent.get('/api/auth/me').expect(401);
  await signIn(saved.email,next);
});

test('API de perfil rejeita campos protegidos, email inválido/duplicado e escritas sem autenticação/CSRF',async()=>{
  const person=await user('active');const {agent}=await signIn(person.email);
  const before=(await repo.byId(person.id));
  for (const payload of [{},{email:'invalid'},{email:null},...['cpf','rg','role','id','name','cnh','access_status','accessStatus','approved_by','password_hash'].map((field)=>({email:'changed@example.test',[field]:field==='role'?'admin':'changed'}))])
    await agent.patch('/api/auth/me').send(payload).expect(400);
  const duplicate=await agent.patch('/api/auth/me').send({email:' MASTER@EXAMPLE.TEST '}).expect(409);
  assert.equal(duplicate.body.error.code,'EMAIL_CONFLICT');
  await agent.patch('/api/auth/me').set('X-CSRF-Token','invalid').send({email:'changed@example.test'}).expect(403);
  await request(app).patch('/api/auth/me').send({email:'changed@example.test'}).expect(401);
  assert.deepEqual((await repo.byId(person.id)),before);
  await agent.patch('/api/auth/me').send({email:person.email.toUpperCase()}).expect(200);
});

for (const role of ['user','admin']) test(`aprovação persiste ${role} e backend aplica suas permissões em cada requisição`,async()=>{
  const person=await user();const owner=await signIn();
  const approved=(await owner.agent.patch(`/api/users/${person.id}/access`).send({action:'approve',role,companyIds:role==='user'?[1]:[]}).expect(200)).body;
  assert.equal(approved.role,role);assert.equal((await repo.byId(person.id)).role,role);
  const {agent,result}=await signIn(person.email);assert.equal(result.body.user.role,role);
  const pending=await user('pending',{email:'next@example.test',cpf:'12345678909',rg:'67890',cnh:'10987654321'});
  const expected=role==='admin'?200:403;
  await agent.get('/api/users').expect(expected);
  await agent.get(`/api/users/${pending.id}`).expect(expected);
  assert.equal((await agent.get('/api/notifications').expect(200)).body.some((row)=>row.type==='access'),role==='admin');
  await agent.patch(`/api/users/${pending.id}/access`).send({action:'approve',role:'user',companyIds:[1]}).expect(expected);
  if (role==='admin') {
    await agent.patch(`/api/users/${person.id}/access`).send({action:'block'}).expect(409);
    await agent.patch(`/api/users/${master.id}/access`).send({action:'block'}).expect(200);
    await agent.patch(`/api/users/${master.id}/access`).send({action:'unblock'}).expect(200);
    await agent.patch(`/api/users/${pending.id}/access`).send({action:'block'}).expect(200);
    await agent.patch(`/api/users/${pending.id}/access`).send({action:'unblock'}).expect(200);
    const server=app.listen(0,'127.0.0.1');await new Promise((resolve)=>server.once('listening',resolve));
    const abort=new AbortController();
    try {
      const stream=await fetch(`http://127.0.0.1:${server.address().port}/api/users/events`,{headers:{Cookie:result.headers['set-cookie'][0].split(';')[0]},signal:abort.signal});
      assert.equal(stream.status,200);const reader=stream.body.getReader();
      assert.match(new TextDecoder().decode((await reader.read()).value),/data: refresh/);
      (await database().prepare("UPDATE users SET role='user' WHERE id=?").run(person.id));
      accessEvents.emit('changed');assert.equal((await reader.read()).done,true);
    } finally {abort.abort();server.closeAllConnections();await new Promise((resolve)=>server.close(resolve))}
    await agent.get('/api/users').expect(403);
    await agent.get('/api/users/events').expect(403);
    await agent.patch(`/api/users/${pending.id}/access`).send({action:'block'}).expect(403);
  } else {
    for (const action of ['reject','block','unblock']) await agent.patch(`/api/users/${pending.id}/access`).send({action}).expect(403);
  }
});

test('aprovação exige user/admin, rejeita elevação a master e role fora da aprovação',async()=>{
  const person=await user();const {agent}=await signIn();
  for (const role of [undefined,'master','owner','ADMIN',null])
    await agent.patch(`/api/users/${person.id}/access`).send({action:'approve',role}).expect(400);
  for (const action of ['reject','block','unblock'])
    await agent.patch(`/api/users/${person.id}/access`).send({action,role:'admin'}).expect(400);
  assert.equal((await repo.byId(person.id)).role,'user');assert.equal((await repo.byId(person.id)).access_status,'pending');
});
test('master aprova, registra responsável, atualiza notificação e bloqueia/revoga/desbloqueia',async()=>{
  const pending=await user();
  const {agent}=await signIn();
  let notifications=(await agent.get('/api/notifications').expect(200)).body;
  const notice=notifications.find((row)=>row.type==='access');
  assert.equal(notice.userId,pending.id);assert.ok(!JSON.stringify(notice).includes(pending.cpf));
  const review=(await agent.get(`/api/users/${pending.id}`).expect(200)).body;
  assert.equal(review.cpf,pending.cpf);assert.equal(review.password_hash,undefined);
  await agent.patch(`/api/users/${pending.id}/access`).send({action:'approve',role:'user',companyIds:[1]}).expect(200);
  const approved=(await repo.byId(pending.id));assert.equal(approved.approved_by,master.id);assert.ok(approved.approved_at);
  notifications=(await agent.get('/api/notifications')).body;
  assert.ok(!notifications.some((row)=>row.userId===pending.id));
  const regular=await signIn(pending.email);
  assert.ok(!(await regular.agent.get('/api/notifications')).body.some((row)=>row.type==='access'));
  await agent.patch(`/api/users/${pending.id}/access`).send({action:'block'}).expect(200);
  await regular.agent.get('/api/auth/me').expect(401);
  await agent.patch(`/api/users/${pending.id}/access`).send({action:'unblock'}).expect(200);
  await regular.agent.get('/api/auth/me').expect(401);
  await signIn(pending.email);
});
test('master rejeita, exige transição válida e impede alteração do próprio acesso',async()=>{
  const person=await user();const {agent}=await signIn();
  await agent.patch(`/api/users/${person.id}/access`).send({action:'reject'}).expect(200);
  await agent.patch(`/api/users/${person.id}/access`).send({action:'approve',role:'user',companyIds:[1]}).expect(409);
  await agent.patch(`/api/users/${master.id}/access`).send({action:'block'}).expect(409);
  (await assert.rejects(async ()=>(await database().prepare('DELETE FROM users WHERE id=?').run(master.id))));
  (await assert.rejects(async ()=>(await database().prepare("UPDATE users SET role='user' WHERE id=?").run(master.id))));
});
test('falha de auditoria desfaz bloqueio e revogação na mesma transação, sem vazar erro',async()=>{
  const person=await user('active');const regular=await signIn(person.email);const {agent}=await signIn();
  (await injectFailure({"name":"fail_audit","event":"INSERT","table":"auth_audit_logs","condition":"NEW.event='user_blocked'"}));
  const response=await agent.patch(`/api/users/${person.id}/access`).send({action:'block'}).expect(409);
  assert.ok(!JSON.stringify(response.body).includes('private internals'));
  assert.equal((await repo.byId(person.id)).access_status,'active');
  await regular.agent.get('/api/auth/me').expect(200);
});
test('CSRF ausente, inválido, Unicode e de outra sessão são recusados; Origin e CORS restritos',async()=>{
  const first=await signIn(),other=await browser();
  for(const csrf of ['', 'errada','é'.repeat(43),other.csrf])
    await first.agent.post('/api/auth/logout').set('X-CSRF-Token',csrf).expect(403);
  await first.agent.post('/api/auth/logout').set('Origin','https://evil.example').expect(403);
  await first.agent.post('/api/auth/logout').unset('Origin').expect(403);
  const response=await request(app).get('/api/auth/csrf').set('Origin','https://evil.example').expect(403);
  assert.notEqual(response.headers['access-control-allow-origin'],'https://evil.example');
  await first.agent.get('/api/auth/me').expect(200);
});
for(const [method,path] of [
  ['get','/clients'],['post','/clients'],['get','/clients/1'],['get','/loans'],['patch','/loans/1'],
  ['put','/clients/1'],['patch','/clients/1'],['post','/loans'],['get','/loans/1'],['patch','/loans/1/installments'],
  ['get','/loans/1/installments'],['put','/loans/1/payment-confirmation'],['post','/installments/1/payments'],
  ['post','/installments/1/payment-preview'],['get','/late-fees/1'],['post','/late-fees/1/payments'],
  ['get','/dashboard/summary'],['get','/reports'],['get','/notifications'],['get','/users'],['get','/users/events'],['get','/payments'],
]) test(`anônimo não acessa ${method} ${path}`,async()=>{
  await request(app)[method](`/api${path}`).expect(401);
});
for(const status of ['pending','rejected','blocked'])test(`status ${status} invalida cookie antigo mesmo sem revogação explícita`,async()=>{
  const person=await user('active');const {agent}=await signIn(person.email);
  (await database().prepare('UPDATE users SET access_status=? WHERE id=?').run(status,person.id));
  await agent.get('/api/auth/me').expect(401);
});
test('trocar senha exige senha atual, revoga todas as sessões e nova senha funciona',async()=>{
  const first=await signIn(),second=await signIn();
  const next=randomBytes(15).toString('base64url');
  await first.agent.post('/api/auth/change-password').send({currentPassword:'errada',newPassword:next}).expect(401);
  await first.agent.post('/api/auth/change-password').send({currentPassword:password,newPassword:next}).expect(200);
  await first.agent.get('/api/auth/me').expect(401);await second.agent.get('/api/auth/me').expect(401);
  await signIn('master@example.test',password,401);
  await signIn('master@example.test',next);
  assert.ok((await repo.byId(master.id)).password_changed_at);
});
test('bootstrap não cria múltiplos masters nem aceita senha ausente ou argumentos CLI',async()=>{
  await assert.rejects((async () => await createMaster({...data(),email:'second@example.test'})),{code:'MASTER_EXISTS'});
  await assert.rejects((async () => await createMaster({...data(),password:undefined})));
  const output=spawnSync(process.execPath,['database/create-master.js','--password'],{cwd:backendRoot,encoding:'utf8'});
  assert.equal(output.status,1);assert.match(output.stderr,/sem argumentos/);assert.equal((await count()),1);
});
test('auditoria e erros não registram documentos, hashes, tokens ou senha',async()=>{
  const {agent}=await signIn();
  await agent.post('/api/auth/logout').expect(200);
  const audit=JSON.stringify((await database().prepare('SELECT * FROM auth_audit_logs').all()));
  for(const secret of [password,'11144477735','password_hash','csrf_token','token_hash'])assert.ok(!audit.includes(secret));
  const messages=[];mock.method(console,'error',(...args)=>messages.push(args.join(' ')));
  let payload;
  const response={status(){return this},json(value){payload=value;return this}};
  errorHandler(new Error(password),{path:'/api/auth/login'},response,()=>{});
  assert.ok(!JSON.stringify({messages,payload}).includes(password));assert.equal(payload.error.code,'INTERNAL_ERROR');
  assert.equal(payload.stack,undefined);
});
test('produção exige HTTPS, configuração explícita e cookie __Host- com todas as flags',()=>{
  const code=`const {app}=await import('./src/app.js'); const {configurePersistence}=await import('./src/application/persistence.js');
    configurePersistence({auth:{insertSession:async()=>{}},'rate-limits':{increment:async()=>({hits:1,reset_at:Date.now()+60000})}}); const request=(await import('supertest')).default;
    const assert=(await import('node:assert/strict')).default;
    for (const origin of ['http://localhost:5173','http://192.168.1.10:5173','https://evil.example']) {
      const rejected=await request(app).get('/api/auth/csrf').set('X-Forwarded-Proto','https').set('Origin',origin);
      assert.equal(rejected.status,403);assert.equal(rejected.headers['access-control-allow-origin'],undefined);
    }
    const cors=await request(app).options('/api/auth/login').set('X-Forwarded-Proto','https').set('Origin','https://paytrack.example').set('Access-Control-Request-Method','POST');
    assert.equal(cors.headers['access-control-allow-origin'],'https://paytrack.example');
    const denied=await request(app).get('/api/health');
    const allowed=await request(app).get('/api/auth/csrf').set('X-Forwarded-Proto','https');
    const cookie=allowed.headers['set-cookie'][0];
    console.log(JSON.stringify({denied:denied.status,allowed:allowed.status,host:cookie.startsWith('__Host-paytrack_session='),
      secure:cookie.includes('; Secure'),httpOnly:cookie.includes('; HttpOnly'),sameSite:cookie.includes('SameSite=Strict'),
      path:cookie.includes('Path=/'),domain:cookie.includes('Domain='),hsts:!!allowed.headers['strict-transport-security']}));`;
  const output=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:backendRoot,encoding:'utf8',env:{...process.env,NODE_ENV:'production',DATABASE_CLIENT:'postgres',DATABASE_URL:'postgresql://localhost/paytrack',FRONTEND_ORIGIN:'https://paytrack.example',TRUST_PROXY:'loopback'}});
  assert.equal(output.status,0,output.stderr);
  assert.deepEqual(JSON.parse(output.stdout.trim()),{denied:400,allowed:200,host:true,secure:true,httpOnly:true,sameSite:true,path:true,domain:false,hsts:true});
  const insecure=spawnSync(process.execPath,['--input-type=module','-e',"await import('./src/config/env.js')"],{cwd:backendRoot,encoding:'utf8',env:{...process.env,NODE_ENV:'production',FRONTEND_ORIGIN:'http://paytrack.example'}});
  assert.equal(insecure.status,1);
});
test('GET financeiro não modifica dados de negócio; health público responde sem cookie',async()=>{
  const {agent}=await signIn();
  const snapshot=async ()=>JSON.stringify((await Promise.all(['clients','loans','payments','installments','late_fees'].map(async (table)=>(await database().prepare(`SELECT * FROM ${table}`).all())))));
  const before=(await snapshot());
  await agent.get('/api/clients').expect(200);await agent.get('/api/loans').expect(200);await agent.get('/api/dashboard/summary').expect(200);
  assert.equal((await snapshot()),before);
  const health=await request(app).get('/api/health').expect(200);assert.equal(health.headers['set-cookie'],undefined);
  assert.ok(authConfig.absoluteMs<=86400000);
});
