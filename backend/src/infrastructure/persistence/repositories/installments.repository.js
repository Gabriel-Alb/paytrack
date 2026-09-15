import { database } from "../connection.js";

export async function findInstallment(id) {
  return (await database()
    .prepare(
      `SELECT i.*, l.client_id, l.loan_date, l.status AS loan_status, l.late_fee_per_day,
    l.revision FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id WHERE i.id=?`,
    )
    .get(id));
}

export async function listInstallments(loanId) {
  return (await database()
    .prepare(
      `SELECT i.*, f.id AS late_fee_id, COALESCE(f.amount, 0) AS late_fee_amount,
    COALESCE(f.paid_amount, 0) AS late_fee_paid_amount, COALESCE(f.days_late, 0) AS days_late,
    f.status AS late_fee_status, f.paid_at AS late_fee_paid_at
    FROM scoped_installments i LEFT JOIN scoped_late_fees f ON f.installment_id=i.id
    WHERE i.loan_id=? ORDER BY i.installment_number`,
    )
    .all(loanId));
}

export async function insertInstallment(data) {
  (await database()
    .prepare(
      `INSERT INTO installments (loan_id, installment_number, amount, due_date)
    VALUES (@loan_id, @installment_number, @amount, @due_date)`,
    )
    .run(data));
}

export async function updateAmounts(items) {
  const statement = database().prepare(
    "UPDATE installments SET amount=?, updated_at=utc_now() WHERE id=?",
  );
  for (const item of items) (await statement.run(item.amount, item.id));
}

export async function reconcileInstallments(date, loanId) {
  (await database()
    .prepare(
      `UPDATE installments SET
    paid_amount=COALESCE((SELECT SUM(p.amount) FROM scoped_payments p WHERE p.installment_id=installments.id AND p.voided_at IS NULL),0),
    paid_at=(SELECT MAX(p.payment_date) FROM scoped_payments p WHERE p.installment_id=installments.id AND p.amount>0 AND p.voided_at IS NULL)
    WHERE (CAST(@loan AS BIGINT) IS NULL OR loan_id=@loan) AND loan_id IN (SELECT id FROM scoped_loans WHERE status<>'cancelled')`,
    )
    .run({ loan: loanId, date }));
  (await database()
    .prepare(
      `UPDATE installments SET status=CASE
      WHEN paid_amount>=amount THEN 'paid' WHEN paid_amount>0 THEN 'partial'
      WHEN due_date<@date THEN 'overdue' ELSE 'pending' END,
    paid_at=CASE WHEN paid_amount>=amount THEN paid_at ELSE NULL END,
    updated_at=utc_now()
    WHERE (CAST(@loan AS BIGINT) IS NULL OR loan_id=@loan) AND loan_id IN (SELECT id FROM scoped_loans WHERE status<>'cancelled')`,
    )
    .run({ loan: loanId, date }));
}

export async function reconcileFees(date, loanId) {
  (await database()
    .prepare(
      `INSERT INTO late_fees (installment_id, days_late, amount)
    SELECT i.id, greatest(0, CAST(day_number(COALESCE(i.paid_at,@date))-day_number(i.due_date) AS INTEGER)),
      greatest(0, CAST(day_number(COALESCE(i.paid_at,@date))-day_number(i.due_date) AS INTEGER))*l.late_fee_per_day
    FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id
    WHERE l.status<>'cancelled' AND (CAST(@loan AS BIGINT) IS NULL OR l.id=@loan)
      AND l.late_fee_per_day>0 AND i.due_date<COALESCE(i.paid_at,@date)
    ON CONFLICT(installment_id) DO UPDATE SET days_late=excluded.days_late, amount=excluded.amount, updated_at=utc_now()
    WHERE late_fees.status<>'waived'`,
    )
    .run({ date, loan: loanId }));
  (await database()
    .prepare(
      `UPDATE late_fees SET
      days_late=greatest(0, CAST(day_number(COALESCE((SELECT paid_at FROM scoped_installments WHERE id=installment_id),@date))
        -day_number((SELECT due_date FROM scoped_installments WHERE id=installment_id)) AS INTEGER)),
      paid_amount=COALESCE((SELECT SUM(p.late_fee_amount) FROM scoped_payments p WHERE p.installment_id=late_fees.installment_id AND p.voided_at IS NULL),0),
      paid_at=(SELECT MAX(p.payment_date) FROM scoped_payments p WHERE p.installment_id=late_fees.installment_id AND p.late_fee_amount>0 AND p.voided_at IS NULL)
    WHERE installment_id IN (SELECT i.id FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id
      WHERE l.status<>'cancelled' AND (CAST(@loan AS BIGINT) IS NULL OR l.id=@loan))`,
    )
    .run({ date, loan: loanId }));
  (await database()
    .prepare(
      `UPDATE late_fees SET amount=days_late*(SELECT l.late_fee_per_day FROM scoped_loans l
    JOIN scoped_installments i ON i.loan_id=l.id WHERE i.id=installment_id), updated_at=utc_now()
    WHERE status<>'waived' AND installment_id IN (SELECT id FROM scoped_installments WHERE CAST(@loan AS BIGINT) IS NULL OR loan_id=@loan)`,
    )
    .run({ loan: loanId }));
  (await database()
    .prepare(
      `UPDATE late_fees SET status=CASE WHEN status='waived' THEN 'waived'
      WHEN paid_amount>=amount THEN 'paid' WHEN paid_amount>0 THEN 'partial' ELSE 'pending' END,
    paid_at=CASE WHEN paid_amount>=amount THEN paid_at ELSE NULL END
    WHERE installment_id IN (SELECT id FROM scoped_installments WHERE CAST(@loan AS BIGINT) IS NULL OR loan_id=@loan)`,
    )
    .run({ loan: loanId }));
}

export async function loanBalances(loanId, date) {
  return (await database()
    .prepare(
      `SELECT l.id, l.client_id, l.status,
    COALESCE(SUM(i.amount-i.paid_amount),0) AS remaining,
    COALESCE(SUM(CASE WHEN f.status<>'waived' THEN greatest(0,f.amount-f.paid_amount) ELSE 0 END),0) AS fee_remaining,
    COALESCE(MAX(CASE WHEN i.paid_amount<i.amount THEN greatest(0,CAST(day_number(@date)-day_number(i.due_date) AS INTEGER)) ELSE 0 END),0) AS days_late
    FROM scoped_loans l LEFT JOIN scoped_installments i ON i.loan_id=l.id LEFT JOIN scoped_late_fees f ON f.installment_id=i.id
    WHERE (CAST(@loan AS BIGINT) IS NULL OR l.id=@loan) AND l.status<>'cancelled' GROUP BY l.id, l.client_id, l.principal_amount, l.interest_percentage, l.interest_amount, l.total_amount, l.installment_count, l.late_fee_per_day, l.loan_date, l.first_due_date, l.status, l.notes, l.created_by, l.revision, l.created_at, l.updated_at, l.company_id`,
    )
    .all({ loan: loanId, date }));
}

export async function saveLoanStatus(id, status) {
  (await database()
    .prepare(
      "UPDATE loans SET status=?, updated_at=utc_now() WHERE id=? AND status<>?",
    )
    .run(status, id, status));
}

export async function clientBalances(clientId, attentionDays, date) {
  return (await database()
    .prepare(
      `SELECT c.id, c.status_override,
    (SELECT COUNT(*) FROM scoped_loans WHERE client_id=c.id AND status<>'cancelled') AS loan_count,
    (SELECT COUNT(*) FROM scoped_loans WHERE client_id=c.id AND status IN ('active','overdue')) AS open_count,
    EXISTS(SELECT 1 FROM scoped_loans l JOIN scoped_installments i ON i.loan_id=l.id LEFT JOIN scoped_late_fees f ON f.installment_id=i.id
      WHERE l.client_id=c.id AND l.status<>'cancelled' AND
      ((i.paid_amount<i.amount AND day_number(@date)-day_number(i.due_date)>@attention)
        OR (i.status='paid' AND f.amount>f.paid_amount AND f.status<>'waived'))) AS negative
    FROM scoped_clients c WHERE CAST(@client AS BIGINT) IS NULL OR c.id=@client`,
    )
    .all({ client: clientId, attention: attentionDays, date }));
}

export async function saveClientStatus(id, status) {
  (await database()
    .prepare(
      "UPDATE clients SET status=?, updated_at=utc_now() WHERE id=? AND status<>?",
    )
    .run(status, id, status));
}
