import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase,closeDatabase } from '../src/config/database.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { randomBytes } from 'node:crypto';

const current=readFileSync(new URL('./fixtures/schema-v4.sql',import.meta.url),'utf8');
const legacyUsers=`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  cpf TEXT UNIQUE,rg TEXT UNIQUE,cnh TEXT UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;
const legacySchema=legacyUsers+current.slice(current.indexOf('CREATE TABLE IF NOT EXISTS clients'));
const financialTables=['clients','loans','installments','payments','late_fees'];
const snapshot=async (db)=>(await Promise.all(financialTables.map(async (table)=>(await db.prepare(`SELECT * FROM ${table}`).all()).map(row=>{const copy={...row};delete copy.company_id;return copy}))));

test('migration v3 amplia auditoria sem inventar autores, preserva histórico e reabre sem alterações',async ()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-action-migration-')),path=join(directory,'audit.db');
  try {
    const old=new Database(path);
    const previous=current.replace(/^\s+(actor_name|entity_type|entity_id|details) .*\r?\n/gm,'')
      .replace(/^CREATE INDEX IF NOT EXISTS idx_auth_audit_entity .*\r?\n/m,'');
    (await old.exec(previous));
    (await old.exec(`PRAGMA user_version=3;
      INSERT INTO users(id,name,email,password_hash,role,access_status) VALUES(1,'Master','master@example.test','hash','master','active');
      INSERT INTO auth_audit_logs(event,actor_id,subject_id,created_at) VALUES('login_success',1,1,1);
      INSERT INTO clients(name,cpf,created_by) VALUES('Cliente legado','52998224725',1);`));
    const finances=(await snapshot(old)),logs=(await old.prepare('SELECT * FROM auth_audit_logs').all());(await old.close());
    let db=(await openDatabase(path));
    assert.deepEqual((await snapshot(db)),finances);
    assert.deepEqual((await db.prepare('SELECT id,event,actor_id,subject_id,created_at FROM auth_audit_logs').all()),logs);
    assert.deepEqual((await db.prepare('SELECT actor_name,entity_type,entity_id,details FROM auth_audit_logs').get()),{actor_name:null,entity_type:null,entity_id:null,details:null});
    (await db.prepare(`INSERT INTO auth_audit_logs(event,actor_id,actor_name,entity_type,entity_id,details,created_at)
      VALUES('client_created',1,'Nome histórico','client',1,?,2)`).run(JSON.stringify({customer:'Cliente legado'})));
    const history=(await db.prepare('SELECT * FROM auth_audit_logs').all());(await closeDatabase());db=(await openDatabase(path));
    assert.deepEqual((await db.prepare('SELECT * FROM auth_audit_logs').all()),history);
    assert.equal((await db.pragma('user_version',{simple:true})),8);assert.deepEqual((await db.pragma('foreign_key_check')),[]);
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true})}
});

test('migration v2 aceita admin e preserva dados, sessões, auditoria, FKs e conversão de master e proteção do último administrador',async ()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-roles-migration-')),path=join(directory,'roles.db');
  try {
    const old=new Database(path);
    (await old.exec(current.replaceAll("'master', 'admin', 'user'","'master', 'user'").replaceAll("'master','admin','user'","'master','user'")));
    (await old.exec(`PRAGMA user_version=2;
      INSERT INTO users(id,name,email,cpf,rg,password_hash,role,access_status) VALUES
        (1,'Master','master@example.test','11144477735','123X','existing-hash','master','active'),
        (2,'Pessoa','person@example.test','52998224725','456X','existing-hash','user','pending');
      INSERT INTO auth_sessions(user_id,token_hash,csrf_token,created_at,expires_at,last_seen_at) VALUES(1,'existing-token-hash','existing-csrf',1,9999999999999,1);
      INSERT INTO auth_audit_logs(event,actor_id,subject_id,created_at) VALUES('access_requested',1,2,1);
      INSERT INTO clients(name,cpf,created_by) VALUES('Cliente','12345678909',1);`));
    const users=(await old.prepare('SELECT * FROM users ORDER BY id').all()),finances=(await snapshot(old));
    const sessions=(await old.prepare('SELECT * FROM auth_sessions').all()),logs=(await old.prepare('SELECT * FROM auth_audit_logs').all());
    (await old.close());
    let db=(await openDatabase(path));
    assert.deepEqual((await db.prepare('SELECT * FROM users ORDER BY id').all()),users.map(user=>({...user,role:user.role==='master'?'admin':user.role,must_change_password:0,temporary_password_expires_at:null})));
    assert.deepEqual((await snapshot(db)),finances);assert.deepEqual((await db.prepare('SELECT * FROM auth_sessions').all()),sessions);
    assert.deepEqual((await db.prepare('SELECT * FROM auth_audit_logs').all()),logs);
    assert.equal((await db.pragma('foreign_keys',{simple:true})),1);assert.deepEqual((await db.pragma('foreign_key_check')),[]);
    (await db.exec("UPDATE users SET role='admin',access_status='active',approved_by=1 WHERE id=2"));
    (await assert.rejects(async ()=>(await db.exec("UPDATE users SET role='invalid' WHERE id=2"))));
    (await db.exec("UPDATE users SET role='user' WHERE id=1"));
    (await assert.rejects(async ()=>(await db.exec("UPDATE users SET role='user' WHERE id=2"))));
    (await assert.rejects(async ()=>(await db.exec("UPDATE users SET access_status='blocked' WHERE id=2"))));
    (await assert.rejects(async ()=>(await db.exec('DELETE FROM users WHERE id=2'))));
    (await closeDatabase());db=(await openDatabase(path));
    assert.equal((await db.prepare('SELECT role FROM users WHERE id=2').get()).role,'admin');
    assert.equal((await db.pragma('user_version',{simple:true})),8);assert.deepEqual((await db.pragma('foreign_key_check')),[]);
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true})}
});

test('migration auth sobre legado preserva usuários, finanças e FKs, normaliza e é idempotente',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-auth-migration-'));
  const path=join(directory,'legacy.db');
  try {
    const legacy=new Database(path);(await legacy.exec(legacySchema));
    const passwordHash=await hashPassword(randomBytes(24).toString('base64url'));
    (await legacy.prepare('INSERT INTO users(id,name,email,cpf,rg,cnh,password_hash,role,active) VALUES (1,?,?,?,?,?,?,?,1)')
      .run('Administrador legado',' MASTER@EXAMPLE.TEST ','111.444.777-35','12.345-x','123.456.789-01',passwordHash,'master'));
    (await legacy.prepare('INSERT INTO users(id,name,email,cpf,password_hash,active) VALUES (2,?,?,?,?,0)')
      .run('Usuário bloqueado',' BLOCKED@EXAMPLE.TEST ','529.982.247-25',passwordHash));
    (await legacy.prepare('INSERT INTO users(id,name,email,cpf,password_hash,active) VALUES (3,?,?,?,?,1)')
      .run('Usuário legado',' PERSON@EXAMPLE.TEST ','123.456.789-09',passwordHash));
    (await legacy.exec(`INSERT INTO clients(id,name,cpf,created_by) VALUES (1,'Cliente legado','52998224725',1);
      INSERT INTO loans(id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date,created_by)
        VALUES(1,1,10000,10000,1,'2026-01-01','2026-01-02',1);
      INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(1,1,1,10000,'2026-01-02');
      INSERT INTO payments(installment_id,amount,payment_date,created_by) VALUES(1,5000,'2026-01-02',1);
      INSERT INTO late_fees(installment_id,days_late,amount) VALUES(1,1,100);`));
    const before=(await snapshot(legacy));(await legacy.close());
    let migrated=(await openDatabase(path));
    const admin=(await migrated.prepare('SELECT * FROM users WHERE id=1').get());
    assert.equal(admin.email,'master@example.test');assert.equal(admin.cpf,'11144477735');
    assert.equal(admin.rg,'12345X');assert.equal(admin.cnh,'12345678901');
    assert.equal(admin.access_status,'active');assert.equal(admin.password_hash,passwordHash);
    assert.ok(!Object.hasOwn(admin,'active'));
    assert.equal((await migrated.prepare('SELECT access_status FROM users WHERE id=2').get()).access_status,'blocked');
    assert.equal((await migrated.prepare('SELECT access_status FROM users WHERE id=3').get()).access_status,'pending');
    assert.deepEqual((await snapshot(migrated)),before);assert.deepEqual((await migrated.pragma('foreign_key_check')),[]);
    const users=(await migrated.prepare('SELECT * FROM users').all());(await closeDatabase());
    migrated=(await openDatabase(path));
    assert.deepEqual((await migrated.prepare('SELECT * FROM users').all()),users);
    assert.deepEqual((await snapshot(migrated)),before);assert.equal((await migrated.pragma('user_version',{simple:true})),8);
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true})}
});
for(const field of ['cpf','rg','cnh','email'])test(`duplicidade normalizada de ${field} aborta toda migration sem mudanças parciais`,async ()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-auth-rollback-'));const path=join(directory,'legacy.db');
  try {
    const legacy=new Database(path);(await legacy.exec(legacySchema));
    const first={email:'a@example.test',cpf:'529.982.247-25',rg:'12.345-x',cnh:'123.456.789-01'};
    const next={email:'b@example.test',cpf:'11144477735',rg:'6789X',cnh:'10987654321'};
    next[field]={email:' A@EXAMPLE.TEST ',cpf:'52998224725',rg:'12345X',cnh:'12345678901'}[field];
    for(const row of [first,next])(await legacy.prepare("INSERT INTO users(name,email,cpf,rg,cnh,password_hash) VALUES('Legado',@email,@cpf,@rg,@cnh,'legacy-unusable-hash')").run(row));
    (await legacy.exec("INSERT INTO clients(name,cpf,created_by) VALUES('Preservar','52998224725',1)"));
    const users=(await legacy.prepare('SELECT * FROM users').all()),before=(await snapshot(legacy));
    (await legacy.close());
    (await assert.rejects(async ()=>(await openDatabase(path)),/duplicidade/));
    const checked=new Database(path);
    assert.deepEqual((await checked.prepare('SELECT * FROM users').all()),users);
    assert.deepEqual((await snapshot(checked)),before);
    assert.ok((await checked.pragma('table_info(users)')).some((row)=>row.name==='active'));
    assert.ok(!(await checked.pragma('table_info(users)')).some((row)=>row.name==='access_status'));
    assert.equal((await checked.pragma('user_version',{simple:true})),0);(await checked.close());
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true})}
});
