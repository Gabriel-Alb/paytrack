import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openSqlite } from '../src/infrastructure/persistence/sqlite.js';

// Recreate the v6 membership shape on a realistic database, retaining financial
// tables, foreign keys, sessions and audit entries from the previous schema.
function legacy(path, invalid=false) {
  const db=openSqlite(path);
  db.exec(`INSERT INTO users(id,name,email,password_hash,role,access_status) VALUES
    (1,'Admin','admin@example.test','hash','admin','active'),(2,'Legado','user@example.test','hash','user','active');
    INSERT INTO user_companies(user_id,company_id) VALUES(2,1),(2,2);
    INSERT INTO auth_audit_logs(event,actor_id,subject_id,created_at) VALUES('access_approved',1,2,100);
    INSERT INTO auth_sessions(user_id,token_hash,csrf_token,created_at,expires_at,last_seen_at) VALUES(2,'hash','csrf',100,9999999999999,100);
    DROP TABLE user_access_companies;
    ALTER TABLE user_companies DROP COLUMN role;
    PRAGMA user_version=6;`);
  if(invalid) {
    db.pragma('foreign_keys=OFF');
    db.exec('INSERT INTO user_companies(user_id,company_id) VALUES(2,999)');
  }
  const snapshot={sessions:db.prepare('SELECT * FROM auth_sessions').all(),audit:db.prepare('SELECT * FROM auth_audit_logs').all(),users:db.prepare('SELECT * FROM users').all()};
  db.close(); return snapshot;
}

test('SQLite v7 preserva vínculos como USER, histórico e sessões; reabrir mantém níveis e decisões',()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-roles-')),path=join(directory,'legacy.db');
  let db;
  try {
    const before=legacy(path); db=openSqlite(path);
    assert.equal(db.pragma('user_version',{simple:true}),8);
    assert.deepEqual(db.prepare('SELECT * FROM user_companies ORDER BY company_id').all(),[{user_id:2,company_id:1,role:'USER'},{user_id:2,company_id:2,role:'USER'}]);
    assert.deepEqual(db.prepare('SELECT * FROM users').all(),before.users);
    assert.deepEqual(db.prepare('SELECT * FROM auth_sessions').all(),before.sessions);
    assert.deepEqual(db.prepare('SELECT * FROM auth_audit_logs').all(),before.audit);
    db.exec("UPDATE user_companies SET role='MANAGER' WHERE company_id=1; INSERT INTO user_access_companies(user_id,company_id,status,company_role,decided_by,decided_at) VALUES(2,1,'approved','MANAGER',1,'2026-09-21 00:00:00')");
    const rows=db.prepare('SELECT * FROM user_access_companies').all();
    db.close(); db=openSqlite(path);
    assert.equal(db.prepare('SELECT role FROM user_companies WHERE company_id=1').get().role,'MANAGER');
    assert.deepEqual(db.prepare('SELECT * FROM user_access_companies').all(),rows);
    assert.deepEqual(db.pragma('foreign_key_check'),[]);
    assert.throws(()=>db.prepare("UPDATE user_companies SET role='admin'").run());
  } finally {db?.close();rmSync(directory,{recursive:true,force:true});}
});

test('SQLite v7 com FK inválida reverte DDL, dados e versão e permite nova tentativa',()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-roles-rollback-')),path=join(directory,'legacy.db');
  let db;
  try {
    legacy(path,true);
    db=new Database(path);
    const schema=db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all();
    const rows=db.prepare('SELECT * FROM user_companies').all(); db.close(); db=null;
    assert.throws(()=>openSqlite(path),/referências inválidas/);
    db=new Database(path);
    assert.equal(db.pragma('user_version',{simple:true}),6);
    assert.deepEqual(db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all(),schema);
    assert.deepEqual(db.prepare('SELECT * FROM user_companies').all(),rows);
    db.prepare('DELETE FROM user_companies WHERE company_id=999').run(); db.close(); db=openSqlite(path);
    assert.equal(db.pragma('user_version',{simple:true}),8);
  } finally {db?.close();rmSync(directory,{recursive:true,force:true});}
});
