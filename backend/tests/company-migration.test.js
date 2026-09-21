import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase,closeDatabase } from '../src/config/database.js';

test('v5 transfere empresas aos contratos, preserva duplicados legados e sequências ao reabrir', async () => {
  const directory=mkdtempSync(join(tmpdir(),'paytrack-global-clients-')),path=join(directory,'legacy.db');
  try {
    const old=new Database(path);
    old.exec(readFileSync(new URL('./fixtures/schema-v5.sql',import.meta.url),'utf8'));
    old.exec(`PRAGMA user_version=5;
      INSERT INTO companies(id,name) VALUES(1,'Primeira'),(2,'Segunda');
      INSERT INTO clients(id,company_id,name,cpf,rg) VALUES(8,1,'Original A','52998224725','RG1'),(9,2,'Original B','52998224725','RG1');
      INSERT INTO loans(id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date)
        VALUES(12,8,1000,1000,1,'2026-01-01','2026-01-02'),(13,9,2000,2000,1,'2026-01-01','2026-01-02');
      INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(15,13,1,2000,'2026-01-02');
      INSERT INTO payments(id,installment_id,amount,payment_date) VALUES(20,15,500,'2026-01-02');
      UPDATE sqlite_sequence SET seq=500 WHERE name IN ('clients','loans');`);
    const before=old.prepare('SELECT * FROM payments').all();
    old.close();
    let db=await openDatabase(path);
    assert.deepEqual(await db.prepare('SELECT id,client_id,company_id FROM loans ORDER BY id').all(),[
      {id:12,client_id:8,company_id:1},{id:13,client_id:9,company_id:2},
    ]);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM clients').get()).n,2);
    assert.deepEqual(await db.prepare('SELECT * FROM payments').all(),before);
    await db.prepare('UPDATE clients SET name=? WHERE id=9').run('Dados preservados');
    await assert.rejects(db.prepare("INSERT INTO clients(name,cpf) VALUES('Duplicado','52998224725')").run());
    await closeDatabase(); db=await openDatabase(path);
    const client=await db.prepare("INSERT INTO clients(name,cpf) VALUES('Novo','11144477735')").run();
    assert.equal(client.lastInsertRowid,501);
    const loan=await db.prepare("INSERT INTO loans(client_id,company_id,principal_amount,total_amount,installment_count,loan_date,first_due_date) VALUES(8,2,100,100,1,'2026-01-01','2026-01-02')").run();
    assert.equal(loan.lastInsertRowid,501);
    assert.deepEqual(await db.pragma('foreign_key_check'),[]);
  } finally { await closeDatabase(); rmSync(directory,{recursive:true,force:true}); }
});

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
    assert.deepEqual((await db.prepare('SELECT * FROM user_companies').all()),[{user_id:1,company_id:2,role:'USER'}]);
    assert.deepEqual((await db.pragma('foreign_key_check')),[]);
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true});}
});

test('v6 preserva histórico, converte master, associa legado e não recria vínculos removidos',async ()=>{
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
    assert.deepEqual((await Promise.all(tables.map(async table=>(await db.prepare(`SELECT * FROM ${table}`).all()).map(row=>{const copy={...row};delete copy.company_id;return copy})))),before);
    assert.ok(!(await db.pragma('table_info(clients)')).some(column=>column.name==='company_id'));
    assert.equal((await db.prepare('SELECT company_id FROM scoped_loans WHERE id=12').get()).company_id,1);
    assert.equal((await db.prepare('SELECT role FROM users WHERE id=1').get()).role,'admin');
    assert.deepEqual((await db.prepare('SELECT * FROM user_companies ORDER BY user_id').all()),[{user_id:2,company_id:1,role:'USER'},{user_id:3,company_id:1,role:'USER'}]);
    (await assert.rejects(async ()=>(await db.exec("UPDATE users SET role='master' WHERE id=1"))));
    (await assert.rejects(async ()=>(await db.exec("INSERT INTO clients(name,cpf) VALUES('Duplicado','52998224725')"))));
    (await db.exec('UPDATE user_companies SET company_id=2 WHERE user_id=2'));
    (await closeDatabase());db=(await openDatabase(path));
    assert.deepEqual((await db.prepare('SELECT company_id FROM user_companies WHERE user_id=2').all()),[{company_id:2}]);
    assert.equal((await db.prepare('SELECT COUNT(*) n FROM companies').get()).n,2);
    assert.deepEqual((await db.pragma('foreign_key_check')),[]);
    assert.equal((await db.pragma('foreign_keys',{simple:true})),1);
    assert.equal((await db.pragma('user_version',{simple:true})),7);
  } finally {(await closeDatabase());rmSync(directory,{recursive:true,force:true});}
});

for (const invalidOwner of ['client', 'company']) {
  test(`v5 com ${invalidOwner} inexistente reverte integralmente a migração`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'paytrack-owner-rollback-'));
    const path = join(directory, 'legacy.db');
    let raw;
    try {
      raw = new Database(path);
      raw.exec(readFileSync(new URL('./fixtures/schema-v5.sql', import.meta.url), 'utf8'));
      raw.pragma('foreign_keys = OFF');
      raw.exec(`PRAGMA user_version=5;
        INSERT INTO companies(id,name) VALUES(1,'Primeira'),(2,'Segunda');
        INSERT INTO clients(id,company_id,name,cpf) VALUES(8,${invalidOwner === 'company' ? 999 : 1},'Preservado','52998224725');
        INSERT INTO loans(id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date)
          VALUES(12,${invalidOwner === 'client' ? 999 : 8},1000,1000,1,'2026-01-01','2026-01-02');
        INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(15,12,1,1000,'2026-01-02');
        INSERT INTO payments(id,installment_id,amount,payment_date) VALUES(20,15,100,'2026-01-02');`);
      const snapshot = db => ({
        schema: db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all(),
        data: Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
          .map(({name}) => [name, db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()])),
        version: db.pragma('user_version', {simple:true}),
      });
      const before = snapshot(raw);
      raw.close(); raw = undefined;
      await assert.rejects(openDatabase(path));
      raw = new Database(path);
      assert.deepEqual(snapshot(raw), before);
      // A failed attempt must not prevent retry after the source link is repaired.
      raw.exec(invalidOwner === 'client'
        ? "INSERT INTO clients(id,company_id,name,cpf) VALUES(999,1,'Recuperado','11144477735')"
        : "INSERT INTO companies(id,name) VALUES(999,'Recuperada')");
      raw.close(); raw = undefined;
      const db = await openDatabase(path);
      assert.deepEqual(await db.prepare('SELECT id,client_id,company_id FROM loans').all(),
        [{id:12,client_id:invalidOwner === 'client' ? 999 : 8,company_id:invalidOwner === 'company' ? 999 : 1}]);
      assert.deepEqual(await db.prepare('SELECT * FROM payments').all(), before.data.payments);
      assert.deepEqual(await db.pragma('foreign_key_check'), []);
    } finally { raw?.close(); await closeDatabase(); rmSync(directory, {recursive:true,force:true}); }
  });
}

test('cliente global e contratos de duas empresas mantêm dados e isolamento após reabrir o arquivo', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'paytrack-owner-reopen-'));
  const path = join(directory, 'persisted.db');
  const {withCompanyAccess} = await import('../src/application/company-access.js');
  try {
    let db = await openDatabase(path);
    await db.prepare("INSERT INTO clients(name,cpf) VALUES('Global','52998224725')").run();
    for (const company of [1,2]) await db.prepare(`INSERT INTO loans(company_id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date)
      VALUES(?,1,1000,1000,1,'2026-01-01','2026-01-02')`).run(company);
    const before = await db.prepare('SELECT * FROM loans ORDER BY id').all();
    await closeDatabase(); db = await openDatabase(path);
    assert.deepEqual(await db.prepare('SELECT * FROM loans ORDER BY id').all(), before);
    assert.ok(!(await db.pragma('table_info(clients)')).some(column => column.name === 'company_id'));
    for (const company of [1,2]) await withCompanyAccess({role:'user',companyIds:[company]}, async () => {
      assert.deepEqual(await db.prepare('SELECT client_id,company_id FROM scoped_loans').all(), [{client_id:1,company_id:company}]);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM scoped_clients').get()).n, 1);
    });
  } finally { await closeDatabase(); rmSync(directory, {recursive:true,force:true}); }
});
