import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { openSqlite } from '../src/infrastructure/persistence/sqlite.js';
import { migratePostgres, verifyPostgres } from '../src/infrastructure/persistence/postgres.js';
import { openDatabase, closeDatabase } from './database-helper.js';
import { importSqlite } from '../src/infrastructure/persistence/import-sqlite.js';

test('SQLite v8 preserva contas v7, migra idempotentemente e reverte DDL com falha', () => {
  const directory = mkdtempSync(join(tmpdir(),'paytrack-recovery-migration-'));
  const path = join(directory,'legacy.db');
  let db;
  try {
    db = openSqlite(path);
    db.exec(`INSERT INTO users(id,name,email,password_hash,role,access_status) VALUES(7,'Legado','legacy@example.test','hash-preservado','user','active');
      DROP TABLE password_reset_requests;
      ALTER TABLE users DROP COLUMN must_change_password;
      ALTER TABLE users DROP COLUMN temporary_password_expires_at;
      PRAGMA user_version=7;
      CREATE TABLE password_reset_requests(injected INTEGER);`);
    db.close(); db = undefined;
    assert.throws(() => openSqlite(path),/column/);
    db = new Database(path);
    assert.equal(db.pragma('user_version',{simple:true}),7);
    assert.ok(!db.pragma('table_info(users)').some(row => row.name==='must_change_password'));
    db.exec('DROP TABLE password_reset_requests');
    db.close(); db = openSqlite(path);
    assert.equal(db.pragma('user_version',{simple:true}),8);
    const user = db.prepare('SELECT * FROM users WHERE id=7').get();
    assert.equal(user.password_hash,'hash-preservado');
    assert.equal(user.must_change_password,0); assert.equal(user.temporary_password_expires_at,null);
    db.prepare('INSERT INTO password_reset_requests(user_id,requested_at,expires_at) VALUES(7,1,10)').run();
    assert.throws(() => db.prepare('INSERT INTO password_reset_requests(user_id,requested_at,expires_at) VALUES(7,2,11)').run());
    db.close(); db = openSqlite(path);
    assert.deepEqual(db.prepare('SELECT * FROM users WHERE id=7').get(),user);
    assert.equal(db.prepare('SELECT count(*) n FROM password_reset_requests').get().n,1);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
  } finally { db?.close(); rmSync(directory,{recursive:true,force:true}); }
});

test('PostgreSQL v4 preserva contas v3, reverte falhas e verifica checksum/idempotência', {skip:!process.env.TEST_DATABASE_URL}, async () => {
  const schema = 'paytrack_recovery_'+randomUUID().replaceAll('-','');
  const pool = new Pool({connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL)');
    for (const [version,file] of [[1,'001-initial.sql'],[2,'002-loan-companies.sql'],[3,'003-company-roles.sql']]) {
      const sql = readFileSync(new URL(`../src/infrastructure/persistence/postgres/${file}`,import.meta.url),'utf8').replaceAll('\r\n','\n');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations VALUES($1,$2)',[version,createHash('sha256').update(sql).digest('hex')]);
    }
    await pool.query(`INSERT INTO users(id,name,email,password_hash,role,access_status) VALUES(7,'Legado','legacy@example.test','hash-preservado','user','active');
      CREATE TABLE password_reset_requests(injected INTEGER);`);
    await assert.rejects(migratePostgres(pool),/already exists/);
    assert.equal((await pool.query('SELECT max(version) n FROM schema_migrations')).rows[0].n,3);
    assert.equal((await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users' AND column_name='must_change_password'")).rows.length,0);
    await pool.query('DROP TABLE password_reset_requests');
    await migratePostgres(pool);
    const user = (await pool.query('SELECT * FROM users WHERE id=7')).rows[0];
    assert.equal(user.password_hash,'hash-preservado');assert.equal(user.must_change_password,0);assert.equal(user.temporary_password_expires_at,null);
    await pool.query('INSERT INTO password_reset_requests(user_id,requested_at,expires_at) VALUES(7,1,10)');
    await assert.rejects(pool.query('INSERT INTO password_reset_requests(user_id,requested_at,expires_at) VALUES(7,2,11)'));
    await migratePostgres(pool); await verifyPostgres(pool);
    assert.deepEqual((await pool.query('SELECT * FROM users WHERE id=7')).rows[0],user);
    assert.equal((await pool.query('SELECT count(*) n FROM password_reset_requests')).rows[0].n,'1');
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await pool.end(); }
});

test('importação SQLite v8 preserva histórico e estado temporário no PostgreSQL sem alterar origem', {skip:!process.env.TEST_DATABASE_URL}, async () => {
  const directory = mkdtempSync(join(tmpdir(),'paytrack-recovery-import-')), path = join(directory,'source.db');
  let source;
  try {
    source = openSqlite(path);
    source.exec(`INSERT INTO users(id,name,email,password_hash,role,access_status,must_change_password,temporary_password_expires_at)
      VALUES(7,'Pessoa','person@example.test','hash-preservado','user','active',1,123456789);
      INSERT INTO password_reset_requests(user_id,status,requested_at,expires_at,resolved_at,resolved_by) VALUES(7,'completed',1,10,2,7);`);
    const user = source.prepare('SELECT * FROM users').get(), requests = source.prepare('SELECT * FROM password_reset_requests').all();
    source.close(); source = undefined;
    const before = readFileSync(path);
    const target = await openDatabase();
    const counts = await importSqlite(path,target);
    assert.equal(counts.password_reset_requests,1);
    assert.deepEqual(await target.prepare('SELECT * FROM users').get(),user);
    assert.deepEqual(await target.prepare('SELECT * FROM password_reset_requests').all(),requests);
    assert.deepEqual(readFileSync(path),before);
  } finally { source?.close(); await closeDatabase(); rmSync(directory,{recursive:true,force:true}); }
});
