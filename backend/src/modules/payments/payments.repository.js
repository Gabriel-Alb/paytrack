import { database } from "../../config/database.js";

export function listPayments(loanId) {
  return database()
    .prepare(
      `SELECT p.id, p.installment_id, p.amount, p.late_fee_amount, p.payment_date,
    p.payment_method, p.notes, p.created_at, p.voided_at, i.installment_number,
    u.name AS registered_by FROM payments p JOIN installments i ON i.id=p.installment_id
    LEFT JOIN users u ON u.id=p.created_by WHERE i.loan_id=? ORDER BY p.id`,
    )
    .all(loanId);
}

export function insertPayment({
  installment_id,
  amount = 0,
  late_fee_amount = 0,
  payment_date,
  payment_method = null,
  notes = null,
}) {
  return Number(
    database()
      .prepare(
        `INSERT INTO payments (installment_id, amount, late_fee_amount, payment_date, payment_method, notes)
    VALUES (@installment_id,@amount,@late_fee_amount,@payment_date,@payment_method,@notes)`,
      )
      .run({
        installment_id,
        amount,
        late_fee_amount,
        payment_date,
        payment_method,
        notes,
      }).lastInsertRowid,
  );
}

export function voidInstallmentPayments(id) {
  database()
    .prepare(
      "UPDATE payments SET voided_at=CURRENT_TIMESTAMP WHERE installment_id=? AND voided_at IS NULL",
    )
    .run(id);
}

export function lastPaymentDate(id) {
  return database()
    .prepare(
      "SELECT MAX(payment_date) AS date FROM payments WHERE installment_id=? AND voided_at IS NULL",
    )
    .get(id).date;
}

export function findPayment(id) {
  return database()
    .prepare(
      "SELECT id, installment_id, amount, late_fee_amount, payment_date, payment_method, notes, created_at, voided_at FROM payments WHERE id=?",
    )
    .get(id);
}
