import { database } from "../../config/database.js";
import { recordAction } from '../auth/auth.repository.js';

const registeredBy = `COALESCE((SELECT a.actor_name FROM auth_audit_logs a
  WHERE a.entity_type='payment' AND a.entity_id=p.id AND a.event IN ('payment_created','payment_corrected')
  ORDER BY a.id LIMIT 1),u.name)`;

function auditPayment(event, actor, id) {
  if (!actor) return;
  const details = database().prepare(`SELECT c.name AS customer,p.amount+p.late_fee_amount AS amount,
    p.payment_date,i.installment_number||'/'||l.installment_count AS installment,l.id AS loanId
    FROM payments p JOIN installments i ON i.id=p.installment_id
    JOIN loans l ON l.id=i.loan_id JOIN clients c ON c.id=l.client_id WHERE p.id=?`).get(id);
  recordAction(event,actor,'payment',id,details);
}

export function listPayments(loanId) {
  return database()
    .prepare(
      `SELECT p.id, p.installment_id, p.amount, p.late_fee_amount, p.payment_date,
    p.payment_method, p.notes, p.created_at, p.voided_at, i.installment_number,
    p.created_by, ${registeredBy} AS registered_by FROM payments p JOIN installments i ON i.id=p.installment_id
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
}, actor, event = 'payment_created') {
  const id = Number(
    database()
      .prepare(
        `INSERT INTO payments (installment_id, amount, late_fee_amount, payment_date, payment_method, notes, created_by)
    VALUES (@installment_id,@amount,@late_fee_amount,@payment_date,@payment_method,@notes,@actorId)`,
      )
      .run({
        installment_id,
        amount,
        late_fee_amount,
        payment_date,
        payment_method,
        notes,
        actorId: actor?.id ?? null,
      }).lastInsertRowid,
  );
  auditPayment(event,actor,id);
  return id;
}

export function voidInstallmentPayments(id, actor) {
  const voided = database()
    .prepare(
      "UPDATE payments SET voided_at=CURRENT_TIMESTAMP WHERE installment_id=? AND voided_at IS NULL RETURNING id",
    )
    .all(id);
  for (const payment of voided) auditPayment('payment_voided',actor,payment.id);
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
      `SELECT p.id, p.installment_id, p.amount, p.late_fee_amount, p.payment_date, p.payment_method,
        p.notes, p.created_at, p.voided_at, p.created_by, ${registeredBy} AS registered_by
        FROM payments p LEFT JOIN users u ON u.id=p.created_by WHERE p.id=?`,
    )
    .get(id);
}
