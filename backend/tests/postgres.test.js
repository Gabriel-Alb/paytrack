import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { openDatabase, closeDatabase, injectFailure } from './database-helper.js';
import { openSqlite } from '../src/infrastructure/persistence/sqlite.js';
import { importSqlite } from '../src/infrastructure/persistence/import-sqlite.js';
import { migratePostgres } from '../src/infrastructure/persistence/postgres.js';
import { tables, checkSchema } from '../src/infrastructure/persistence/check.js';
import { insertUser } from '../src/modules/auth/auth.repository.js';
import { hashPassword, login } from '../src/modules/auth/auth.service.js';
import { backendRoot } from '../src/config/env.js';

afterEach(closeDatabase);
if (process.env.TEST_DATABASE_URL) {
  test('upgrade PostgreSQL v1 preserva empresas, duplicados legados e histórico', async () => {
    const schema='paytrack_upgrade_'+randomUUID().replaceAll('-','');
    const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`});
    try {
      await pool.query(`CREATE SCHEMA ${schema}`);
      const initial=readFileSync(new URL('../src/infrastructure/persistence/postgres/001-initial.sql',import.meta.url),'utf8').replaceAll('\r\n','\n');
      await pool.query(initial);
      await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL)');
      await pool.query('INSERT INTO schema_migrations VALUES(1,$1)',[createHash('sha256').update(initial).digest('hex')]);
      await pool.query(`SELECT set_config('paytrack.access','{"role":"admin","companyIds":[]}',false);
        INSERT INTO clients(id,company_id,name,cpf) VALUES(8,1,'Legado A','52998224725'),(9,2,'Legado B','52998224725');
        INSERT INTO loans(id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date)
          VALUES(12,8,1000,1000,1,'2026-01-01','2026-01-02'),(13,9,2000,2000,1,'2026-01-01','2026-01-02');
        INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(15,13,1,2000,'2026-01-02');
        INSERT INTO payments(id,installment_id,amount,payment_date) VALUES(20,15,500,'2026-01-02');`);
      await migratePostgres(pool);
      await migratePostgres(pool);
      assert.deepEqual((await pool.query('SELECT id,client_id,company_id FROM loans ORDER BY id')).rows,[
        {id:'12',client_id:'8',company_id:'1'},{id:'13',client_id:'9',company_id:'2'},
      ]);
      assert.equal((await pool.query('SELECT count(*) AS n FROM clients')).rows[0].n,'2');
      assert.equal((await pool.query('SELECT amount FROM payments WHERE id=20')).rows[0].amount,'500');
      await pool.query("UPDATE clients SET name='Preservado' WHERE id=9");
      await assert.rejects(pool.query("INSERT INTO clients(name,cpf) VALUES('Duplicado','52998224725')"),{code:'23505'});
      await pool.query(`SELECT set_config('paytrack.access','{"role":"user","companyIds":[1]}',false)`);
      assert.equal((await pool.query('SELECT id FROM scoped_loans')).rows[0].id,'12');
      assert.equal((await pool.query('SELECT count(*) AS n FROM scoped_payments')).rows[0].n,'0');
      await assert.rejects(pool.query("UPDATE loans SET notes='Invadido' WHERE id=13"),{code:'23514'});
    } finally { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await pool.end(); }
  });
  test('ambiente production autentica e consulta a API usando PostgreSQL real', async () => {
    const db = await openDatabase();
    const schema = (await db.prepare('SELECT current_schema() AS name').get()).name;
    const code = `
      import request from 'supertest';
      import assert from 'node:assert/strict';
      import {app} from './src/app.js';
      import {openDatabase,closeDatabase} from './src/config/database.js';
      import {createMaster} from './src/modules/auth/auth.service.js';
      try {
        const db=await openDatabase({schema:${JSON.stringify(schema)}});
        assert.equal(db.dialect,'postgres');
        await createMaster({name:'Produção teste',email:'production@example.test',cpf:'52998224725',password:'Producao123'});
        const headers={'X-Forwarded-Proto':'https',Origin:'https://paytrack.example'};
        const csrf=await request(app).get('/api/auth/csrf').set(headers).expect(200);
        const login=await request(app).post('/api/auth/login').set(headers)
          .set('Cookie',csrf.headers['set-cookie'][0].split(';')[0]).set('X-CSRF-Token',csrf.body.csrfToken)
          .send({email:'production@example.test',password:'Producao123'}).expect(200);
        assert.match(login.headers['set-cookie'][0],/^__Host-paytrack_session=/);
        assert.match(login.headers['set-cookie'][0],/; Secure/);
        const cookie=login.headers['set-cookie'][0].split(';')[0];
        await request(app).get('/api/clients').set(headers).set('Cookie',cookie).expect(200);
        await request(app).get('/api/health').expect(400);
        console.log('production-postgres-ok');
      } finally {await closeDatabase();}
    `;
    const result = spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:backendRoot,encoding:'utf8',timeout:30000,
      env:{...process.env,NODE_ENV:'production',DATABASE_CLIENT:'postgres',DATABASE_URL:process.env.TEST_DATABASE_URL,
        DATABASE_SSL:'disable',FRONTEND_ORIGIN:'https://paytrack.example',TRUST_PROXY:'loopback'}});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout.trim(),'production-postgres-ok');
  });
  test('migrations PostgreSQL são idempotentes, verificam checksum e indexam todas as FKs', async () => {
    const db = await openDatabase();
    const schema = (await db.prepare('SELECT current_schema() AS name').get()).name;
    const pool = new Pool({ connectionString:process.env.TEST_DATABASE_URL, options:`-c search_path=${schema}` });
    try {
      await migratePostgres(pool);
      await migratePostgres(pool);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM schema_migrations').get()).n,2);
      assert.equal((await db.prepare('SELECT count(*) AS n FROM companies').get()).n,2);
      assert.deepEqual(await db.prepare(`SELECT c.conname FROM pg_constraint c
        WHERE c.contype='f' AND c.connamespace=current_schema()::regnamespace
        AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indkey[0]=c.conkey[1])`).all(),[]);
      assert.equal((await checkSchema(db)).version,2);
      await db.prepare("UPDATE schema_migrations SET checksum='invalid'").run();
      await assert.rejects(migratePostgres(pool),/Checksum/);
    } finally { await pool.end(); }
  });
  async function sourceDatabase(path) {
    const db = openSqlite(path);
    db.exec(`INSERT INTO users(id,name,email,password_hash,role,access_status) VALUES
      (7,'Administrador','admin@example.test','hash-preservado','admin','active'),
      (9,'Usuário','user@example.test','outro-hash','user','active');
      UPDATE users SET approved_by=7 WHERE id=9;
      INSERT INTO user_companies(user_id,company_id) VALUES(9,2);
      INSERT INTO clients(id,name,cpf,created_by) VALUES(11,'Importado','52998224725',9);
      INSERT INTO loans(id,company_id,client_id,principal_amount,interest_percentage,interest_amount,total_amount,installment_count,late_fee_per_day,loan_date,first_due_date,created_by)
        VALUES(15,2,11,50000000000,100,50000000000,100000000000,1,125,'2024-02-28','2024-02-29',9);
      INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(18,15,1,100000000000,'2024-02-29');
      INSERT INTO payments(id,installment_id,amount,late_fee_amount,payment_date,created_by,voided_at)
        VALUES(21,18,50000000000,125,'2024-03-01',9,'2024-03-02 12:00:00');
      INSERT INTO late_fees(id,installment_id,amount,days_late) VALUES(25,18,125,1);
      INSERT INTO auth_sessions(id,user_id,token_hash,csrf_token,created_at,expires_at,last_seen_at)
        VALUES(29,9,'token-hash-preservado','csrf-preservado',1709251200000,9999999999999,1709251200000);
      INSERT INTO auth_audit_logs(id,event,actor_id,actor_name,entity_type,entity_id,details,created_at)
        VALUES(31,'payment_created',9,'Usuário','payment',21,'{"customer":"Importado"}',1709251200000);
      INSERT INTO auth_rate_limits(key,hits,reset_at) VALUES('hash-limit',2,9999999999999);
      UPDATE sqlite_sequence SET seq=500 WHERE name IN ('users','payments');`);
    db.prepare('UPDATE users SET password_hash=?').run(await hashPassword('Importacao123'));
    return db;
  }
  test('importação preserva todas as tabelas, documentos, hashes, autoria, datas, centavos e sequences', async () => {
    const directory = mkdtempSync(join(tmpdir(),'paytrack-import-'));
    const path = join(directory,'source.db');
    let source;
    try {
      source = await sourceDatabase(path);
      const before = Object.fromEntries(tables.map(table => [table,source.prepare(`SELECT * FROM ${table}`).all()]));
      source.close(); source = undefined;
      const target = await openDatabase();
      const counts = await importSqlite(path,target);
      for (const table of tables) {
        assert.equal(counts[table],before[table].length);
        assert.deepEqual(await target.prepare(`SELECT * FROM ${table}`).all(),before[table],table);
      }
      assert.equal((await login({email:'user@example.test',password:'Importacao123'})).user.id,9);
      assert.equal(await insertUser({name:'Novo',email:'new@example.test',cpf:null,passwordHash:'hash'},'user','pending'),501);
      const payment = await target.prepare("INSERT INTO payments(installment_id,amount,payment_date) VALUES(18,1,'2024-03-01')").run();
      assert.equal(payment.lastInsertRowid,501);
      await assert.rejects(importSqlite(path,target),/não está vazio/);
      source = openSqlite(path);
      for (const table of tables) assert.deepEqual(source.prepare(`SELECT * FROM ${table}`).all(),before[table]);
    } finally { source?.close(); rmSync(directory,{recursive:true,force:true}); }
  });
  test('falha na importação reverte todos os registros e permite tentar novamente', async () => {
    const directory = mkdtempSync(join(tmpdir(),'paytrack-import-rollback-'));
    const path = join(directory,'source.db');
    try {
      const source = await sourceDatabase(path); source.close();
      const target = await openDatabase();
      await injectFailure({name:'fail_import',event:'INSERT',table:'payments',condition:'NEW.amount>0'});
      await assert.rejects(importSqlite(path,target));
      for (const table of tables.filter(table => table !== 'companies'))
        assert.equal((await target.prepare(`SELECT count(*) AS n FROM ${table}`).get()).n,0,table);
      assert.equal((await target.prepare('SELECT count(*) AS n FROM companies').get()).n,2);
      await target.exec('DROP TRIGGER fail_import ON payments; DROP FUNCTION fail_import()');
      assert.equal((await importSqlite(path,target)).payments,1);
    } finally { rmSync(directory,{recursive:true,force:true}); }
  });
}
