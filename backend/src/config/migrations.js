export function migrate(db, schema) {
  if (
    !db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'payments'",
      )
      .get()
  )
    return;
  db.transaction(() => {
    const paymentColumns = db
      .pragma("table_info(payments)")
      .map(({ name }) => name);
    if (!paymentColumns.includes("late_fee_amount")) {
      const table = schema.match(
        /CREATE TABLE IF NOT EXISTS payments \([\s\S]*?\n\);/,
      )[0];
      db.exec(table.replace("payments (", "payments_migrating ("));
      db.exec(`INSERT INTO payments_migrating (id, installment_id, amount, payment_date, payment_method, notes, created_by, created_at)
        SELECT id, installment_id, amount, payment_date, payment_method, notes, created_by, created_at FROM payments`);
      db.exec(
        "DROP TABLE payments; ALTER TABLE payments_migrating RENAME TO payments;",
      );
      db.exec(`INSERT INTO payments (installment_id, amount, late_fee_amount, payment_date, notes)
        SELECT installment_id, 0, paid_amount, substr(COALESCE(paid_at, updated_at), 1, 10),
          'Saldo de multa anterior à migração' FROM late_fees WHERE paid_amount > 0`);
    }
    if (
      !db
        .pragma("table_info(clients)")
        .some(({ name }) => name === "status_override")
    ) {
      db.exec(
        "ALTER TABLE clients ADD COLUMN status_override TEXT CHECK (status_override IS NULL OR status_override = 'negativado')",
      );
    }
    if (
      !db.pragma("table_info(loans)").some(({ name }) => name === "revision")
    ) {
      db.exec(
        "ALTER TABLE loans ADD COLUMN revision INTEGER NOT NULL DEFAULT 0",
      );
    }
    db.pragma("user_version = 1");
  })();
}
