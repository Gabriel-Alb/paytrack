import { beforeEach,afterEach,test,mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import { app } from '../src/app.js';
import { openDatabase,closeDatabase,database } from '../src/config/database.js';
import { env,backendRoot } from '../src/config/env.js';
import { authConfig } from '../src/config/auth.js';
import { createMaster,hashPassword,hashToken,verifyPassword } from '../src/modules/auth/auth.service.js';
import { passwordSchema } from '../src/modules/auth/auth.validator.js';
import * as repo from '../src/modules/auth/auth.repository.js';
import { errorHandler } from '../src/shared/middleware/errors.js';

let password,master;
const data = () => ({name:'Pessoa teste',email:'person@example.test',cpf:'529.982.247-25',rg:'12.345-x',cnh:'12345678901',password});
beforeEach(async()=>{
  openDatabase(':memory:');
  password=randomBytes(24).toString('base64url');
  master=await createMaster({name:'Master teste',email:'master@example.test',cpf:'11144477735',password});
});
afterEach(()=>{mock.restoreAll();closeDatabase()});
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
  const id=repo.insertUser({...input,cpf:input.cpf.replace(/\D/g,''),rg:input.rg.replace(/[^a-z\d]/gi,'').toUpperCase(),passwordHash:await hashPassword(input.password)},'user',status);
  return repo.byId(id);
}
const count=()=>database().prepare('SELECT count(*) n FROM users').get().n;

test('pré-cadastro normaliza documentos/e-mail, persiste Argon2id e não autentica',async()=>{
  const {agent}=await browser();
  const result=await agent.post('/api/auth/request-access').send({...data(),email:' PERSON@EXAMPLE.TEST '}).expect(202);
  const saved=repo.byEmail('person@example.test');
  assert.equal(saved.role,'user');assert.equal(saved.access_status,'pending');
  assert.equal(saved.cpf,'52998224725');assert.equal(saved.rg,'12345X');
  assert.ok(saved.password_hash.startsWith('$argon2id$v=19$'));
  assert.deepEqual(saved.password_hash.split('$')[3].split(',').sort(),['m=19456','p=1','t=2']);
  assert.ok(await verifyPassword(saved.password_hash,password));
  assert.ok(!JSON.stringify(saved).includes(password));
  assert.deepEqual(Object.keys(result.body),['message']);
  await agent.get('/api/auth/me').expect(401);
  assert.equal(database().prepare('SELECT count(*) n FROM auth_sessions WHERE user_id IS NOT NULL').get().n,0);
  assert.equal(database().prepare("SELECT count(*) n FROM auth_audit_logs WHERE event='access_requested'").get().n,1);
});
test('Argon2id usa salts diferentes por senha e verifica sem truncamento',async()=>{
  const long='😀'.repeat(128);
  const first=await hashPassword(long),second=await hashPassword(long);
  assert.ok(first!==second);assert.ok(first.split('$')[4]!==second.split('$')[4]);
  assert.ok(Buffer.from(first.split('$')[4],'base64').length>=16);
  assert.ok(await verifyPassword(first,long));assert.ok(!await verifyPassword(first,long.slice(0,-2)));
});
for (const field of ['role','access_status','approved_by','password_hash'])
  test(`cadastro rejeita mass assignment de ${field}`,async()=>{
    const {agent}=await browser();
    await agent.post('/api/auth/request-access').send({...data(),[field]:field==='role'?'master':'active'}).expect(400);
    assert.equal(count(),1);
  });
test('valida CPF, email, tipo, comprimento e payload; permite 128 pontos Unicode e espaços',async()=>{
  assert.equal(passwordSchema.parse('😀'.repeat(128)),'😀'.repeat(128));
  assert.equal(passwordSchema.parse('uma frase longa com espaços'), 'uma frase longa com espaços');
  assert.throws(()=>passwordSchema.parse('x'.repeat(129)));
  for(const change of [{cpf:'11111111111'},{email:'bad'},{password:'curta'},{password:15}]) {
    const {agent}=await browser();
    await agent.post('/api/auth/request-access').send({...data(),...change}).expect(400);
  }
  const {agent}=await browser();
  await agent.post('/api/auth/login').send({email:'a'.repeat(140000),password}).expect(400);
});
for(const key of ['email','cpf','rg','cnh'])
  test(`duplicidade de ${key} mantém unicidade sem enumerar dados`,async()=>{
    const {agent}=await browser();
    const first=await agent.post('/api/auth/request-access').send(data()).expect(202);
    const second={...data(),email:'other@example.test',cpf:'12345678909',rg:'54321X',cnh:'10987654321',[key]:key==='email'?'PERSON@EXAMPLE.TEST':data()[key]};
    const result=await agent.post('/api/auth/request-access').send(second).expect(202);
    assert.deepEqual(result.body,first.body);assert.equal(count(),2);
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
  const session=repo.sessionByHash(hashToken(raw));
  assert.ok(session.user_id);assert.notEqual(session.token_hash,raw);
  assert.ok(!JSON.stringify(database().prepare('SELECT * FROM auth_sessions').all()).includes(raw));
  assert.ok(!JSON.stringify(result.body).includes(raw));
  assert.notEqual(cookie.split(';')[0],anonymous);
  const me=await agent.get('/api/auth/me').expect(200);
  assert.deepEqual(Object.keys(me.body.user).sort(),['accessStatus','email','id','name','role']);
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
  assert.equal(count(),2);
});
test('rate limit por conta soma IPs e sobrevive a novos agentes',async()=>{
  for(let n=0;n<env.AUTH_LOGIN_ACCOUNT_LIMIT;n++) await signIn('missing@example.test','wrong',401);
  const {result}=await signIn('MISSING@EXAMPLE.TEST','wrong',429);
  assert.equal(result.body.error.code,'TOO_MANY_ATTEMPTS');
  assert.equal(result.headers['x-ratelimit-remaining'],undefined);
});
test('rate limit por IP bloqueia emails variados e não confia em X-Forwarded-For',async()=>{
  const {agent}=await browser();
  for(let n=0;n<env.AUTH_LOGIN_IP_LIMIT;n++)
    await agent.post('/api/auth/login').set('X-Forwarded-For',`198.51.100.${n+1}`).send({email:`test${n}@example.test`,password:'wrong'}).expect(401);
  await agent.post('/api/auth/login').send({email:'new@example.test',password:'wrong'}).expect(429);
});
test('limita solicitação de acesso',async()=>{
  const {agent}=await browser();
  for(let n=0;n<env.AUTH_REQUEST_IP_LIMIT;n++) await agent.post('/api/auth/request-access').send({...data(),email:`test${n}@example.test`}).expect(202);
  await agent.post('/api/auth/request-access').send({...data(),email:'new@example.test'}).expect(429);
  database().exec('UPDATE auth_rate_limits SET reset_at=1');
  await agent.post('/api/auth/request-access').send({...data(),email:'new@example.test'}).expect(202);
});
test('login pode ser tentado novamente após janela, sem bloqueio permanente',async()=>{
  for(let n=0;n<env.AUTH_LOGIN_ACCOUNT_LIMIT;n++)await signIn('master@example.test','wrong',401);
  await signIn('master@example.test',password,429);
  database().exec('UPDATE auth_rate_limits SET reset_at=1');
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
    database().exec(sql);
    await agent.get('/api/auth/me').expect(401);
  });
test('usuário comum não lista, avalia, aprova a si mesmo nem altera role',async()=>{
  const person=await user('active');
  const {agent}=await signIn(person.email);
  await agent.get('/api/users').expect(403);
  await agent.get(`/api/users/${person.id}`).expect(403);
  await agent.patch(`/api/users/${person.id}/access`).send({action:'approve',role:'master'}).expect(403);
  assert.equal(repo.byId(person.id).role,'user');
});
test('master aprova, registra responsável, atualiza notificação e bloqueia/revoga/desbloqueia',async()=>{
  const pending=await user();
  const {agent}=await signIn();
  let notifications=(await agent.get('/api/notifications').expect(200)).body;
  const notice=notifications.find((row)=>row.type==='access');
  assert.equal(notice.userId,pending.id);assert.ok(!JSON.stringify(notice).includes(pending.cpf));
  const review=(await agent.get(`/api/users/${pending.id}`).expect(200)).body;
  assert.equal(review.cpf,pending.cpf);assert.equal(review.password_hash,undefined);
  await agent.patch(`/api/users/${pending.id}/access`).send({action:'approve'}).expect(200);
  const approved=repo.byId(pending.id);assert.equal(approved.approved_by,master.id);assert.ok(approved.approved_at);
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
  await agent.patch(`/api/users/${person.id}/access`).send({action:'approve'}).expect(409);
  await agent.patch(`/api/users/${master.id}/access`).send({action:'block'}).expect(409);
  assert.throws(()=>database().prepare('DELETE FROM users WHERE id=?').run(master.id));
  assert.throws(()=>database().prepare("UPDATE users SET role='user' WHERE id=?").run(master.id));
});
test('falha de auditoria desfaz bloqueio e revogação na mesma transação, sem vazar erro',async()=>{
  const person=await user('active');const regular=await signIn(person.email);const {agent}=await signIn();
  database().exec("CREATE TRIGGER fail_audit BEFORE INSERT ON auth_audit_logs WHEN NEW.event='user_blocked' BEGIN SELECT RAISE(ABORT,'private internals'); END");
  const response=await agent.patch(`/api/users/${person.id}/access`).send({action:'block'}).expect(409);
  assert.ok(!JSON.stringify(response.body).includes('private internals'));
  assert.equal(repo.byId(person.id).access_status,'active');
  await regular.agent.get('/api/auth/me').expect(200);
});
test('CSRF ausente, inválido, Unicode e de outra sessão são recusados; Origin e CORS restritos',async()=>{
  const first=await signIn(),other=await browser();
  for(const csrf of ['', 'wrong','é'.repeat(43),other.csrf])
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
  ['get','/dashboard/summary'],['get','/reports'],['get','/notifications'],['get','/users'],['get','/payments'],
]) test(`anônimo não acessa ${method} ${path}`,async()=>{
  await request(app)[method](`/api${path}`).expect(401);
});
for(const status of ['pending','rejected','blocked'])test(`status ${status} invalida cookie antigo mesmo sem revogação explícita`,async()=>{
  const person=await user('active');const {agent}=await signIn(person.email);
  database().prepare('UPDATE users SET access_status=? WHERE id=?').run(status,person.id);
  await agent.get('/api/auth/me').expect(401);
});
test('trocar senha exige senha atual, revoga todas as sessões e nova senha funciona',async()=>{
  const first=await signIn(),second=await signIn();
  const next=randomBytes(24).toString('base64url');
  await first.agent.post('/api/auth/change-password').send({currentPassword:'wrong',newPassword:next}).expect(401);
  await first.agent.post('/api/auth/change-password').send({currentPassword:password,newPassword:next}).expect(200);
  await first.agent.get('/api/auth/me').expect(401);await second.agent.get('/api/auth/me').expect(401);
  await signIn('master@example.test',password,401);
  await signIn('master@example.test',next);
  assert.ok(repo.byId(master.id).password_changed_at);
});
test('bootstrap não cria múltiplos masters nem aceita senha ausente ou argumentos CLI',async()=>{
  await assert.rejects(createMaster({...data(),email:'second@example.test'}),{code:'MASTER_EXISTS'});
  await assert.rejects(createMaster({...data(),password:undefined}));
  const output=spawnSync(process.execPath,['database/create-master.js','--password'],{cwd:backendRoot,encoding:'utf8'});
  assert.equal(output.status,1);assert.match(output.stderr,/sem argumentos/);assert.equal(count(),1);
});
test('auditoria e erros não registram documentos, hashes, tokens ou senha',async()=>{
  const {agent}=await signIn();
  await agent.post('/api/auth/logout').expect(200);
  const audit=JSON.stringify(database().prepare('SELECT * FROM auth_audit_logs').all());
  for(const secret of [password,'11144477735','password_hash','csrf_token','token_hash'])assert.ok(!audit.includes(secret));
  const messages=[];mock.method(console,'error',(...args)=>messages.push(args.join(' ')));
  let payload;
  const response={status(){return this},json(value){payload=value;return this}};
  errorHandler(new Error(password),{path:'/api/auth/login'},response,()=>{});
  assert.ok(!JSON.stringify({messages,payload}).includes(password));assert.equal(payload.error.code,'INTERNAL_ERROR');
  assert.equal(payload.stack,undefined);
});
test('produção exige HTTPS, configuração explícita e cookie __Host- com todas as flags',()=>{
  const code=`const {app}=await import('./src/app.js'); const {openDatabase}=await import('./src/config/database.js');
    openDatabase(':memory:'); const request=(await import('supertest')).default;
    const denied=await request(app).get('/api/health');
    const allowed=await request(app).get('/api/auth/csrf').set('X-Forwarded-Proto','https');
    const cookie=allowed.headers['set-cookie'][0];
    console.log(JSON.stringify({denied:denied.status,allowed:allowed.status,host:cookie.startsWith('__Host-paytrack_session='),
      secure:cookie.includes('; Secure'),httpOnly:cookie.includes('; HttpOnly'),sameSite:cookie.includes('SameSite=Strict'),
      path:cookie.includes('Path=/'),domain:cookie.includes('Domain='),hsts:!!allowed.headers['strict-transport-security']}));`;
  const output=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:backendRoot,encoding:'utf8',env:{...process.env,NODE_ENV:'production',FRONTEND_ORIGIN:'https://paytrack.example',TRUST_PROXY:'loopback'}});
  assert.equal(output.status,0,output.stderr);
  assert.deepEqual(JSON.parse(output.stdout.trim()),{denied:400,allowed:200,host:true,secure:true,httpOnly:true,sameSite:true,path:true,domain:false,hsts:true});
  const insecure=spawnSync(process.execPath,['--input-type=module','-e',"await import('./src/config/env.js')"],{cwd:backendRoot,encoding:'utf8',env:{...process.env,NODE_ENV:'production',FRONTEND_ORIGIN:'http://paytrack.example'}});
  assert.equal(insecure.status,1);
});
test('GET financeiro não modifica dados de negócio; health público responde sem cookie',async()=>{
  const {agent}=await signIn();
  const snapshot=()=>JSON.stringify(['clients','loans','payments','installments','late_fees'].map((table)=>database().prepare(`SELECT * FROM ${table}`).all()));
  const before=snapshot();
  await agent.get('/api/clients').expect(200);await agent.get('/api/loans').expect(200);await agent.get('/api/dashboard/summary').expect(200);
  assert.equal(snapshot(),before);
  const health=await request(app).get('/api/health').expect(200);assert.equal(health.headers['set-cookie'],undefined);
  assert.ok(authConfig.absoluteMs<=86400000);
});
