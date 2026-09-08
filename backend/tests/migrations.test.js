import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase, closeDatabase } from '../src/config/database.js';
import { refreshFinancialState } from '../src/modules/installments/installments.service.js';

const schema = readFileSync(new URL('../../SQL/schema.sql', import.meta.url), 'utf8');

test('migração preserva pagamentos, multas e referências; reabertura é idempotente', () => {
  const directory = mkdtempSync(join(tmpdir(), 'paytrack-migration-'));
  const path = join(directory, 'legacy.db');
  try {
    const legacy = new Database(path);
    legacy.exec(
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
    );
    legacy.exec(`INSERT INTO clients (id,name,cpf) VALUES (1,'Legado','52998224725');
      INSERT INTO loans (id,client_id,principal_amount,total_amount,installment_count,late_fee_per_day,loan_date,first_due_date)
        VALUES (1,1,1000,1000,1,100,'2026-01-01','2026-01-02');
      INSERT INTO installments (id,loan_id,installment_number,amount,due_date,paid_amount,paid_at) VALUES (1,1,1,1000,'2026-01-02',1000,'2026-01-04');
      INSERT INTO payments (id,installment_id,amount,payment_date) VALUES (1,1,1000,'2026-01-04');
      INSERT INTO late_fees (installment_id,days_late,amount,paid_amount,paid_at) VALUES (1,2,200,100,'2026-01-04');`);
    legacy.close();
    let db = openDatabase(path);
    refreshFinancialState();
    assert.equal(db.prepare('SELECT SUM(amount) n FROM payments').get().n, 1000);
    assert.equal(db.prepare('SELECT SUM(late_fee_amount) n FROM payments').get().n, 100);
    assert.equal(db.prepare('SELECT amount FROM installments').get().amount, 1000);
    assert.equal(db.prepare('SELECT paid_amount FROM late_fees').get().paid_amount, 100);
    assert.equal(db.prepare('SELECT status FROM loans').get().status, 'overdue');
    assert.equal(db.pragma('user_version', { simple: true }), 1);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    const payments = db.prepare('SELECT * FROM payments').all();
    closeDatabase();
    db = openDatabase(path);
    assert.deepEqual(db.prepare('SELECT * FROM payments').all(), payments);
  } finally {
    closeDatabase();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('falha durante migração restaura schema e dados anteriores', () => {
  const directory = mkdtempSync(join(tmpdir(), 'paytrack-migration-'));
  const path = join(directory, 'broken.db');
  try {
    const legacy = new Database(path);
    legacy.exec(
      schema
        .replace(/ {4}late_fee_amount[^\n]+\n/, '')
        .replace(/ {4}voided_at[^\n]+\n/, '')
        .replace(/ {4}CHECK \(amount > 0 OR late_fee_amount > 0\),\n/, ''),
    );
    legacy.pragma('foreign_keys = OFF');
    legacy.exec(
      "INSERT INTO payments (installment_id,amount,payment_date) VALUES (999,100,'2026-01-01')",
    );
    legacy.close();
    assert.throws(() => openDatabase(path));
    const checked = new Database(path);
    assert.equal(checked.prepare('SELECT amount FROM payments').get().amount, 100);
    assert.ok(!checked.pragma('table_info(payments)').some((c) => c.name === 'late_fee_amount'));
    assert.equal(checked.pragma('user_version', { simple: true }), 0);
    checked.close();
  } finally {
    closeDatabase();
    rmSync(directory, { recursive: true, force: true });
  }
});
