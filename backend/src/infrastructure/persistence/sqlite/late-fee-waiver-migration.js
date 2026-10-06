export function migrateLateFeeWaivers(db) {
  if (db.pragma('table_info(late_fees)').some(column => column.name === 'waived_amount')) return;
  db.exec(`ALTER TABLE late_fees ADD COLUMN waived_amount INTEGER NOT NULL DEFAULT 0 CHECK (waived_amount >= 0);
    UPDATE late_fees SET waived_amount=MAX(0,amount-paid_amount) WHERE status='waived'`);
}
