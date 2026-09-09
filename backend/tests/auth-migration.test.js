import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase,closeDatabase } from '../src/config/database.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import { randomBytes } from 'node:crypto';

const current=readFileSync(new URL('../../SQL/schema.sql',import.meta.url),'utf8');
const legacyUsers=`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  cpf TEXT UNIQUE,rg TEXT UNIQUE,cnh TEXT UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;
const legacySchema=legacyUsers+current.slice(current.indexOf('CREATE TABLE IF NOT EXISTS clients'));
const financialTables=['clients','loans','installments','payments','late_fees'];
const snapshot=(db)=>financialTables.map((table)=>db.prepare(`SELECT * FROM ${table}`).all());

test('migration auth sobre legado preserva usuários, finanças e FKs, normaliza e é idempotente',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-auth-migration-'));
  const path=join(directory,'legacy.db');
  try {
    const legacy=new Database(path);legacy.exec(legacySchema);
    const passwordHash=await hashPassword(randomBytes(24).toString('base64url'));
    legacy.prepare('INSERT INTO users(id,name,email,cpf,rg,cnh,password_hash,role,active) VALUES (1,?,?,?,?,?,?,?,1)')
      .run('Administrador legado',' MASTER@EXAMPLE.TEST ','111.444.777-35','12.345-x','123.456.789-01',passwordHash,'master');
    legacy.prepare('INSERT INTO users(id,name,email,cpf,password_hash,active) VALUES (2,?,?,?,?,0)')
      .run('Usuário bloqueado',' BLOCKED@EXAMPLE.TEST ','529.982.247-25',passwordHash);
    legacy.prepare('INSERT INTO users(id,name,email,cpf,password_hash,active) VALUES (3,?,?,?,?,1)')
      .run('Usuário legado',' PERSON@EXAMPLE.TEST ','123.456.789-09',passwordHash);
    legacy.exec(`INSERT INTO clients(id,name,cpf,created_by) VALUES (1,'Cliente legado','52998224725',1);
      INSERT INTO loans(id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date,created_by)
        VALUES(1,1,10000,10000,1,'2026-01-01','2026-01-02',1);
      INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(1,1,1,10000,'2026-01-02');
      INSERT INTO payments(installment_id,amount,payment_date,created_by) VALUES(1,5000,'2026-01-02',1);
      INSERT INTO late_fees(installment_id,days_late,amount) VALUES(1,1,100);`);
    const before=snapshot(legacy);legacy.close();
    let migrated=openDatabase(path);
    const admin=migrated.prepare('SELECT * FROM users WHERE id=1').get();
    assert.equal(admin.email,'master@example.test');assert.equal(admin.cpf,'11144477735');
    assert.equal(admin.rg,'12345X');assert.equal(admin.cnh,'12345678901');
    assert.equal(admin.access_status,'active');assert.equal(admin.password_hash,passwordHash);
    assert.ok(!Object.hasOwn(admin,'active'));
    assert.equal(migrated.prepare('SELECT access_status FROM users WHERE id=2').get().access_status,'blocked');
    assert.equal(migrated.prepare('SELECT access_status FROM users WHERE id=3').get().access_status,'pending');
    assert.deepEqual(snapshot(migrated),before);assert.deepEqual(migrated.pragma('foreign_key_check'),[]);
    const users=migrated.prepare('SELECT * FROM users').all();closeDatabase();
    migrated=openDatabase(path);
    assert.deepEqual(migrated.prepare('SELECT * FROM users').all(),users);
    assert.deepEqual(snapshot(migrated),before);assert.equal(migrated.pragma('user_version',{simple:true}),2);
  } finally {closeDatabase();rmSync(directory,{recursive:true,force:true})}
});
for(const field of ['cpf','rg','cnh','email'])test(`duplicidade normalizada de ${field} aborta toda migration sem mudanças parciais`,()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-auth-rollback-'));const path=join(directory,'legacy.db');
  try {
    const legacy=new Database(path);legacy.exec(legacySchema);
    const first={email:'a@example.test',cpf:'529.982.247-25',rg:'12.345-x',cnh:'123.456.789-01'};
    const next={email:'b@example.test',cpf:'11144477735',rg:'6789X',cnh:'10987654321'};
    next[field]={email:' A@EXAMPLE.TEST ',cpf:'52998224725',rg:'12345X',cnh:'12345678901'}[field];
    for(const row of [first,next])legacy.prepare("INSERT INTO users(name,email,cpf,rg,cnh,password_hash) VALUES('Legado',@email,@cpf,@rg,@cnh,'legacy-unusable-hash')").run(row);
    legacy.exec("INSERT INTO clients(name,cpf,created_by) VALUES('Preservar','52998224725',1)");
    const users=legacy.prepare('SELECT * FROM users').all(),before=snapshot(legacy);
    legacy.close();
    assert.throws(()=>openDatabase(path),/duplicidade/);
    const checked=new Database(path);
    assert.deepEqual(checked.prepare('SELECT * FROM users').all(),users);
    assert.deepEqual(snapshot(checked),before);
    assert.ok(checked.pragma('table_info(users)').some((row)=>row.name==='active'));
    assert.ok(!checked.pragma('table_info(users)').some((row)=>row.name==='access_status'));
    assert.equal(checked.pragma('user_version',{simple:true}),0);checked.close();
  } finally {closeDatabase();rmSync(directory,{recursive:true,force:true})}
});
