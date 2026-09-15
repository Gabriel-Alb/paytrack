import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase,closeDatabase } from '../src/config/database.js';

test('schema atual aplicado manualmente inicializa sem perder empresas já vinculadas',async ()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-company-schema-')),path=join(directory,'schema.db');
  try {
    const initial=new Database(path);
    (await initial.exec(readFileSync(new URL('../../SQL/schema.sql',import.meta.url),'utf8')));
    (await initial.exec(`INSERT INTO companies(id,name) VALUES(1,'Dinheiro Express'),(2,'Platinum Finance');
      INSERT INTO users(id,name,email,password_hash,role,access_status) VALUES(1,'Pessoa','person@example.test','hash','user','active');
      INSERT INTO user_companies(user_id,company_id) VALUES(1,2);`));
    (await initial.close());
    const db=(await openDatabase(path));
    assert.deepEqual((await db.prepare('SELECT * FROM user_companies').all()),[{user_id:1,company_id:2}]);
    assert.deepEqual((await db.pragma('foreign_key_check')),[]);
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true});}
});

test('v5 preserva histórico, converte master, associa legado e não recria vínculos removidos',async ()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-company-migration-')),path=join(directory,'legacy.db');
  try {
    const old=new Database(path);
    (await old.exec(readFileSync(new URL('./fixtures/schema-v4.sql',import.meta.url),'utf8')));
    (await old.exec(`PRAGMA user_version=4;
      INSERT INTO users(id,name,email,password_hash,role,access_status) VALUES
        (1,'Antigo master','one@example.test','hash','master','active'),
        (2,'Padrão ativo','two@example.test','hash','user','active'),
        (3,'Padrão bloqueado','three@example.test','hash','user','blocked'),
        (4,'Pendente','four@example.test','hash','user','pending');
      INSERT INTO clients(id,name,cpf,created_by) VALUES(8,'Legado','52998224725',2);
      INSERT INTO loans(id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date,created_by)
        VALUES(12,8,1000,1000,1,'2026-01-01','2026-01-02',2);
      INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(15,12,1,1000,'2026-01-02');
      INSERT INTO payments(id,installment_id,amount,payment_date,created_by) VALUES(20,15,500,'2026-01-02',2);
      INSERT INTO auth_audit_logs(event,actor_id,entity_type,entity_id,details,created_at) VALUES('payment_created',2,'payment',20,'{"customer":"Legado"}',1);`));
    const tables=['loans','installments','payments','auth_audit_logs'];
    const before=(await Promise.all(tables.map(async table=>(await old.prepare(`SELECT * FROM ${table}`).all()))));(await old.close());
    let db=(await openDatabase(path));
    assert.deepEqual((await Promise.all(tables.map(async table=>(await db.prepare(`SELECT * FROM ${table}`).all())))),before);
    assert.equal((await db.prepare('SELECT company_id FROM clients WHERE id=8').get()).company_id,1);
    assert.equal((await db.prepare('SELECT company_id FROM scoped_loans WHERE id=12').get()).company_id,1);
    assert.equal((await db.prepare('SELECT role FROM users WHERE id=1').get()).role,'admin');
    assert.deepEqual((await db.prepare('SELECT * FROM user_companies ORDER BY user_id').all()),[{user_id:2,company_id:1},{user_id:3,company_id:1}]);
    (await assert.rejects(async ()=>(await db.exec("UPDATE users SET role='master' WHERE id=1"))));
    (await db.exec("INSERT INTO clients(name,cpf,company_id) VALUES('Outra empresa','52998224725',2)"));
    (await assert.rejects(async ()=>(await db.exec("INSERT INTO clients(name,cpf,company_id) VALUES('Duplicado','52998224725',1)"))));
    (await db.exec('UPDATE user_companies SET company_id=2 WHERE user_id=2'));
    (await closeDatabase());db=(await openDatabase(path));
    assert.deepEqual((await db.prepare('SELECT company_id FROM user_companies WHERE user_id=2').all()),[{company_id:2}]);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM companies').get()).n,2);
    assert.deepEqual((await db.pragma('foreign_key_check')),[]);
    assert.equal((await db.pragma('foreign_keys',{simple:true})),1);
    assert.equal((await db.pragma('user_version',{simple:true})),5);
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true});}
});
