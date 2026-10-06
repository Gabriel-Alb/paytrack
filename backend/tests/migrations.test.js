import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase, closeDatabase } from '../src/config/database.js';
import { refreshFinancialState } from '../src/modules/installments/installments.service.js';

const schema = readFileSync(new URL('./fixtures/schema-v4.sql', import.meta.url), 'utf8');

test('migração preserva pagamentos, multas e referências; reabertura é idempotente', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'paytrack-migration-'));
  const path = join(directory, 'legacy.db');
  try {
    const legacy = new Database(path);
    (await legacy.exec(
      schema
        .replace(/ {4}status_override[^\n]+\n/, '')
        .replace(/ {4}revision[^\n]+\n/, '')
        .replace(/ {4}late_fee_amount[^\n]+\n/, '')
        .replace(/ {4}voided_at[^\n]+\n/, '')
        .replace(/ {4}CHECK \(amount > 0 OR late_fee_amount > 0\),\n/, '')
        .replace(
          'amount INTEGER NOT NULL CHECK (amount >= 0)',
          'amount INTEGER NOT NULL CHECK (amount > 0)',
        ),
    ));
    (await legacy.exec(`INSERT INTO clients (id,name,cpf) VALUES (1,'Legado','52998224725');
      INSERT INTO loans (id,client_id,principal_amount,total_amount,installment_count,late_fee_per_day,loan_date,first_due_date)
        VALUES (1,1,1000,1000,1,100,'2026-01-01','2026-01-02');
      INSERT INTO installments (id,loan_id,installment_number,amount,due_date,paid_amount,paid_at) VALUES (1,1,1,1000,'2026-01-02',1000,'2026-01-04');
      INSERT INTO payments (id,installment_id,amount,payment_date) VALUES (1,1,1000,'2026-01-04');
      INSERT INTO late_fees (installment_id,days_late,amount,paid_amount,paid_at) VALUES (1,2,200,100,'2026-01-04');`));
    (await legacy.close());
    let db = (await openDatabase(path));
    (await refreshFinancialState());
    assert.equal((await db.prepare('SELECT SUM(amount) n FROM payments').get()).n, 1000);
    assert.equal((await db.prepare('SELECT SUM(late_fee_amount) n FROM payments').get()).n, 100);
    assert.equal((await db.prepare('SELECT amount FROM installments').get()).amount, 1000);
    assert.equal((await db.prepare('SELECT paid_amount FROM late_fees').get()).paid_amount, 100);
    assert.equal((await db.prepare('SELECT status FROM loans').get()).status, 'overdue');
    assert.equal((await db.pragma('user_version', { simple: true })), 11);
    assert.deepEqual((await db.pragma('foreign_key_check')), []);
    const payments = (await db.prepare('SELECT * FROM payments').all());
    (await closeDatabase());
    db = (await openDatabase(path));
    assert.deepEqual((await db.prepare('SELECT * FROM payments').all()), payments);
  } finally {
    (await closeDatabase());
    rmSync(directory, { recursive: true, force: true });
  }
});

test('falha durante migração restaura schema e dados anteriores', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'paytrack-migration-'));
  const path = join(directory, 'broken.db');
  try {
    const legacy = new Database(path);
    (await legacy.exec(
      schema
        .replace(/ {4}late_fee_amount[^\n]+\n/, '')
        .replace(/ {4}voided_at[^\n]+\n/, '')
        .replace(/ {4}CHECK \(amount > 0 OR late_fee_amount > 0\),\n/, ''),
    ));
    (await legacy.pragma('foreign_keys = OFF'));
    (await legacy.exec(
      "INSERT INTO payments (installment_id,amount,payment_date) VALUES (999,100,'2026-01-01')",
    ));
    (await legacy.close());
    (await assert.rejects(async () => (await openDatabase(path))));
    const checked = new Database(path);
    assert.equal((await checked.prepare('SELECT amount FROM payments').get()).amount, 100);
    assert.ok(!(await checked.pragma('table_info(payments)')).some((c) => c.name === 'late_fee_amount'));
    assert.equal((await checked.pragma('user_version', { simple: true })), 0);
    (await checked.close());
  } finally {
    (await closeDatabase());
    rmSync(directory, { recursive: true, force: true });
  }
});


test('migração de edição remove apenas trava do cliente e preserva pagamentos e empresa',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'paytrack-loan-edit-migration-'));
  const path=join(directory,'legacy.db');
  try {
    let db=await openDatabase(path);
    await db.exec("INSERT INTO clients(id,name,cpf) VALUES(1,'Original','52998224725'),(2,'Novo','11144477735');");
    await db.exec("INSERT INTO loans(id,company_id,client_id,principal_amount,total_amount,installment_count,loan_date,first_due_date) VALUES(1,1,1,1000,1000,1,'2026-01-01','2026-01-01');");
    await db.exec("INSERT INTO installments(id,loan_id,installment_number,amount,due_date) VALUES(1,1,1,1000,'2026-01-01'); INSERT INTO payments(installment_id,amount,payment_date) VALUES(1,100,'2026-01-01');");
    const before=await db.prepare('SELECT * FROM payments').all();
    await closeDatabase();
    const legacy=new Database(path);
    legacy.exec("CREATE TRIGGER loans_client_immutable BEFORE UPDATE OF client_id ON loans WHEN NEW.client_id<>OLD.client_id BEGIN SELECT RAISE(ABORT,'Loan client is immutable'); END; PRAGMA user_version=8;");
    legacy.close();
    db=await openDatabase(path);
    assert.equal(await db.pragma('user_version',{simple:true}), 11);
    await db.prepare('UPDATE loans SET client_id=2 WHERE id=1').run();
    await assert.rejects(db.prepare('UPDATE loans SET company_id=2 WHERE id=1').run());
    assert.deepEqual(await db.prepare('SELECT * FROM payments').all(),before);
    assert.deepEqual(await db.pragma('foreign_key_check'),[]);
    await closeDatabase();
    db=await openDatabase(path);
    assert.equal((await db.prepare('SELECT client_id FROM loans WHERE id=1').get()).client_id,2);
    assert.deepEqual(await db.prepare('SELECT * FROM payments').all(),before);
  } finally {
    await closeDatabase();
    rmSync(directory,{recursive:true,force:true});
  }
});
