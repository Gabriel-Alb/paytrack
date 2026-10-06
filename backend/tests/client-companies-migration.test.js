import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { openSqlite } from '../src/infrastructure/persistence/sqlite.js';
import { migrateClientCompanies } from '../src/infrastructure/persistence/sqlite/client-company-migration.js';
import { migratePostgres } from '../src/infrastructure/persistence/postgres.js';

const fixture = `
  INSERT INTO clients(id,name,cpf) VALUES(10,'Duas empresas','52998224725'),(20,'Sem empréstimo','11144477735'),(30,'Somente B','12345678909');
  INSERT INTO loans(id,client_id,company_id,principal_amount,total_amount,installment_count,loan_date,first_due_date,status)
    VALUES(40,10,1,1000,1000,1,'2026-01-01','2026-01-02','active'),
      (41,10,2,1000,1000,1,'2026-01-01','2026-01-02','paid'),
      (42,10,1,1000,1000,1,'2026-01-01','2026-01-02','cancelled'),
      (43,30,2,1000,1000,1,'2026-01-01','2026-01-02','active');
  INSERT INTO installments(id,loan_id,installment_number,amount,due_date,paid_amount) VALUES(50,40,1,1000,'2026-01-02',500);
  INSERT INTO late_fees(id,installment_id,amount,days_late) VALUES(60,50,100,1);
  INSERT INTO payments(id,installment_id,amount,late_fee_amount,payment_date,voided_at)
    VALUES(70,50,500,0,'2026-01-02',NULL),(71,50,100,0,'2026-01-02','2026-01-03 00:00:00');`;
const preserved = ['clients','loans','installments','payments','late_fees'];
const expected = [{client_id:10,company_id:1},{client_id:10,company_id:2},{client_id:30,company_id:2}];
const schemaSql = file => readFileSync(new URL('../src/infrastructure/persistence/postgres/'+file,import.meta.url),'utf8').replaceAll('\r\n','\n');

test('SQLite v10 → v11 só adiciona vínculos, preserva todos os registros e pode repetir o backfill', () => {
  const directory = mkdtempSync(join(tmpdir(),'paytrack-client-migration-'));
  const path = join(directory,'legacy.db');
  let db;
  try {
    db = new Database(path);
    db.exec(readFileSync(new URL('../../SQL/schema.sql',import.meta.url),'utf8'));
    db.exec("INSERT INTO companies(id,name) VALUES(1,'Empresa A'),(2,'Empresa B'); PRAGMA user_version=10;");
    db.exec(fixture);
    const before = preserved.map(table=>db.prepare(`SELECT * FROM ${table} ORDER BY id`).all());
    const sequences = db.prepare('SELECT * FROM sqlite_sequence ORDER BY name').all();
    db.close(); db = openSqlite(path);
    assert.deepEqual(preserved.map(table=>db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()),before);
    assert.deepEqual(db.prepare('SELECT * FROM sqlite_sequence ORDER BY name').all(),sequences);
    assert.deepEqual(db.prepare('SELECT * FROM client_companies ORDER BY client_id,company_id').all(),expected);
    migrateClientCompanies(db); migrateClientCompanies(db);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM client_companies').get().n,3);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM clients WHERE id=20').get().n,1);
    db.close(); db = openSqlite(path);
    assert.deepEqual(preserved.map(table=>db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()),before);
    assert.equal(db.pragma('user_version',{simple:true}),12);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
  } finally { db?.close(); rmSync(directory,{recursive:true,force:true}); }
});

test('PostgreSQL v6 → v7 preserva registros, sequências, órfãos e vínculos únicos após repetir o runner', {skip:!process.env.TEST_DATABASE_URL}, async () => {
  const schema = 'paytrack_client_migration_'+randomUUID().replaceAll('-','');
  const pool = new Pool({connectionString:process.env.TEST_DATABASE_URL,max:1,options:`-c search_path=${schema}`});
  try {
    await pool.query(`CREATE SCHEMA ${schema}; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL)`);
    for (const [index,file] of ['001-initial.sql','002-loan-companies.sql','003-company-roles.sql','004-password-recovery.sql','005-loan-editing.sql','006-loan-company-editing.sql'].entries()) {
      const sql = schemaSql(file);
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations VALUES($1,$2)',[index+1,createHash('sha256').update(sql).digest('hex')]);
    }
    await pool.query(`SELECT set_config('paytrack.access','{"role":"admin","companyIds":[]}',false)`);
    await pool.query(fixture);
    const before = await Promise.all(preserved.map(async table=>(await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows));
    const sequences = (await pool.query('SELECT sequencename,last_value FROM pg_sequences WHERE schemaname=$1 ORDER BY sequencename',[schema])).rows;
    // Fail after table creation/backfill to prove the migration transaction rolls back.
    await pool.query('CREATE TRIGGER guard_clients BEFORE DELETE ON clients FOR EACH ROW EXECUTE FUNCTION guard_clients()');
    await assert.rejects(migratePostgres(pool), /already exists/);
    assert.equal((await pool.query("SELECT to_regclass('client_companies') AS relation")).rows[0].relation,null);
    assert.equal((await pool.query('SELECT MAX(version) AS version FROM schema_migrations')).rows[0].version,6);
    assert.deepEqual(await Promise.all(preserved.map(async table=>(await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows)),before);
    await pool.query('DROP TRIGGER guard_clients ON clients');
    await migratePostgres(pool); await migratePostgres(pool);
    const migrated = before.map((rows, index) => preserved[index] === 'late_fees'
      ? rows.map(row => ({ ...row, waived_amount: '0' })) : rows);
    assert.deepEqual(await Promise.all(preserved.map(async table=>(await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows)),migrated);
    assert.deepEqual((await pool.query('SELECT sequencename,last_value FROM pg_sequences WHERE schemaname=$1 ORDER BY sequencename',[schema])).rows,sequences);
    assert.deepEqual((await pool.query('SELECT * FROM client_companies ORDER BY client_id,company_id')).rows.map(row=>({client_id:Number(row.client_id),company_id:Number(row.company_id)})),expected);
    assert.equal((await pool.query('SELECT COUNT(*) n FROM clients WHERE id=20')).rows[0].n,'1');
    assert.equal((await pool.query('SELECT COUNT(*) n FROM scoped_clients')).rows[0].n,'3');
    await pool.query(`SELECT set_config('paytrack.access','{"role":"user","companyIds":[1]}',false)`);
    assert.deepEqual((await pool.query('SELECT id FROM scoped_clients')).rows,[{id:'10'}]);
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await pool.end(); }
});
