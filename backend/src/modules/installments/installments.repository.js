import { database } from "../../config/database.js";

export function findInstallment(id) {
  return database()
    .prepare(
      `SELECT i.*, l.client_id, l.loan_date, l.status AS loan_status, l.late_fee_per_day,
    l.revision FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id WHERE i.id=?`,
    )
    .get(id);
}

export function listInstallments(loanId) {
  return database()
    .prepare(
      `SELECT i.*, f.id AS late_fee_id, COALESCE(f.amount, 0) AS late_fee_amount,
    COALESCE(f.paid_amount, 0) AS late_fee_paid_amount, COALESCE(f.days_late, 0) AS days_late,
    f.status AS late_fee_status, f.paid_at AS late_fee_paid_at
    FROM scoped_installments i LEFT JOIN scoped_late_fees f ON f.installment_id=i.id
    WHERE i.loan_id=? ORDER BY i.installment_number`,
    )
    .all(loanId);
}

export function insertInstallment(data) {
  database()
    .prepare(
      `INSERT INTO installments (loan_id, installment_number, amount, due_date)
    VALUES (@loan_id, @installment_number, @amount, @due_date)`,
    )
    .run(data);
}

export function updateAmounts(items) {
  const statement = database().prepare(
    "UPDATE installments SET amount=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
  );
  for (const item of items) statement.run(item.amount, item.id);
}

export function reconcileInstallments(date, loanId) {
  database()
    .prepare(
      `UPDATE installments SET
    paid_amount=COALESCE((SELECT SUM(p.amount) FROM scoped_payments p WHERE p.installment_id=installments.id AND p.voided_at IS NULL),0),
    paid_at=(SELECT MAX(p.payment_date) FROM scoped_payments p WHERE p.installment_id=installments.id AND p.amount>0 AND p.voided_at IS NULL)
    WHERE (@loan IS NULL OR loan_id=@loan) AND loan_id IN (SELECT id FROM scoped_loans WHERE status<>'cancelled')`,
    )
    .run({ loan: loanId, date });
  database()
    .prepare(
      `UPDATE installments SET status=CASE
      WHEN paid_amount>=amount THEN 'paid' WHEN paid_amount>0 THEN 'partial'
      WHEN due_date<@date THEN 'overdue' ELSE 'pending' END,
    paid_at=CASE WHEN paid_amount>=amount THEN paid_at ELSE NULL END,
    updated_at=CURRENT_TIMESTAMP
    WHERE (@loan IS NULL OR loan_id=@loan) AND loan_id IN (SELECT id FROM scoped_loans WHERE status<>'cancelled')`,
    )
    .run({ loan: loanId, date });
}

export function reconcileFees(date, loanId) {
  database()
    .prepare(
      `INSERT INTO late_fees (installment_id, days_late, amount)
    SELECT i.id, MAX(0, CAST(julianday(COALESCE(i.paid_at,@date))-julianday(i.due_date) AS INTEGER)),
      MAX(0, CAST(julianday(COALESCE(i.paid_at,@date))-julianday(i.due_date) AS INTEGER))*l.late_fee_per_day
    FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id
    WHERE l.status<>'cancelled' AND (@loan IS NULL OR l.id=@loan)
      AND l.late_fee_per_day>0 AND i.due_date<COALESCE(i.paid_at,@date)
    ON CONFLICT(installment_id) DO UPDATE SET days_late=excluded.days_late, amount=excluded.amount, updated_at=CURRENT_TIMESTAMP
    WHERE late_fees.status<>'waived'`,
    )
    .run({ date, loan: loanId });
  database()
    .prepare(
      `UPDATE late_fees SET
      days_late=MAX(0, CAST(julianday(COALESCE((SELECT paid_at FROM scoped_installments WHERE id=installment_id),@date))
        -julianday((SELECT due_date FROM scoped_installments WHERE id=installment_id)) AS INTEGER)),
      paid_amount=COALESCE((SELECT SUM(p.late_fee_amount) FROM scoped_payments p WHERE p.installment_id=late_fees.installment_id AND p.voided_at IS NULL),0),
      paid_at=(SELECT MAX(p.payment_date) FROM scoped_payments p WHERE p.installment_id=late_fees.installment_id AND p.late_fee_amount>0 AND p.voided_at IS NULL)
    WHERE installment_id IN (SELECT i.id FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id
      WHERE l.status<>'cancelled' AND (@loan IS NULL OR l.id=@loan))`,
    )
    .run({ date, loan: loanId });
  database()
    .prepare(
      `UPDATE late_fees SET amount=days_late*(SELECT l.late_fee_per_day FROM scoped_loans l
    JOIN scoped_installments i ON i.loan_id=l.id WHERE i.id=installment_id), updated_at=CURRENT_TIMESTAMP
    WHERE status<>'waived' AND installment_id IN (SELECT id FROM scoped_installments WHERE @loan IS NULL OR loan_id=@loan)`,
    )
    .run({ loan: loanId });
  database()
    .prepare(
      `UPDATE late_fees SET status=CASE WHEN status='waived' THEN 'waived'
      WHEN paid_amount>=amount THEN 'paid' WHEN paid_amount>0 THEN 'partial' ELSE 'pending' END,
    paid_at=CASE WHEN paid_amount>=amount THEN paid_at ELSE NULL END
    WHERE installment_id IN (SELECT id FROM scoped_installments WHERE @loan IS NULL OR loan_id=@loan)`,
    )
    .run({ loan: loanId });
}

export function loanBalances(loanId, date) {
  return database()
    .prepare(
      `SELECT l.id, l.client_id, l.status,
    COALESCE(SUM(i.amount-i.paid_amount),0) AS remaining,
    COALESCE(SUM(CASE WHEN f.status<>'waived' THEN MAX(0,f.amount-f.paid_amount) ELSE 0 END),0) AS fee_remaining,
    COALESCE(MAX(CASE WHEN i.paid_amount<i.amount THEN MAX(0,CAST(julianday(@date)-julianday(i.due_date) AS INTEGER)) ELSE 0 END),0) AS days_late
    FROM scoped_loans l LEFT JOIN scoped_installments i ON i.loan_id=l.id LEFT JOIN scoped_late_fees f ON f.installment_id=i.id
    WHERE (@loan IS NULL OR l.id=@loan) AND l.status<>'cancelled' GROUP BY l.id`,
    )
    .all({ loan: loanId, date });
}

export function saveLoanStatus(id, status) {
  database()
    .prepare(
      "UPDATE loans SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status<>?",
    )
    .run(status, id, status);
}

export function clientBalances(clientId, attentionDays, date) {
  return database()
    .prepare(
      `SELECT c.id, c.status_override,
    (SELECT COUNT(*) FROM scoped_loans WHERE client_id=c.id AND status<>'cancelled') AS loan_count,
    (SELECT COUNT(*) FROM scoped_loans WHERE client_id=c.id AND status IN ('active','overdue')) AS open_count,
    EXISTS(SELECT 1 FROM scoped_loans l JOIN scoped_installments i ON i.loan_id=l.id LEFT JOIN scoped_late_fees f ON f.installment_id=i.id
      WHERE l.client_id=c.id AND l.status<>'cancelled' AND
      ((i.paid_amount<i.amount AND julianday(@date)-julianday(i.due_date)>@attention)
        OR (i.status='paid' AND f.amount>f.paid_amount AND f.status<>'waived'))) AS negative
    FROM scoped_clients c WHERE @client IS NULL OR c.id=@client`,
    )
    .all({ client: clientId, attention: attentionDays, date });
}

export function saveClientStatus(id, status) {
  database()
    .prepare(
      "UPDATE clients SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status<>?",
    )
    .run(status, id, status);
}
