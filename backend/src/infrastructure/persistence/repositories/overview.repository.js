import { database } from "../connection.js";

export async function portfolioAt(date) {
  return (await database()
    .prepare(
      `SELECT COALESCE(SUM(greatest(0,l.total_amount-COALESCE(p.received,0))),0) AS amount
    FROM scoped_loans l LEFT JOIN (SELECT i.loan_id,SUM(p.amount) AS received FROM scoped_payments p
      JOIN scoped_installments i ON i.id=p.installment_id WHERE p.voided_at IS NULL AND p.payment_date<=@date GROUP BY i.loan_id) p ON p.loan_id=l.id
    WHERE l.loan_date<=@date AND l.status<>'cancelled'`,
    )
    .get({ date })).amount;
}

export async function receipts(start, end) {
  return (await database()
    .prepare(
      `SELECT COALESCE(SUM(amount+late_fee_amount),0) AS amount,COUNT(*) AS count
    FROM scoped_payments WHERE voided_at IS NULL AND payment_date BETWEEN ? AND ?`,
    )
    .get(start, end));
}

export async function receiptDays(start, end) {
  return (await database()
    .prepare(
      `SELECT payment_date AS date,SUM(amount+late_fee_amount) AS value
    FROM scoped_payments WHERE voided_at IS NULL AND payment_date BETWEEN ? AND ? GROUP BY payment_date ORDER BY payment_date`,
    )
    .all(start, end));
}

export async function portfolioStatus(date, attention) {
  return (await database()
    .prepare(
      `WITH balances AS (SELECT l.id,
    MAX(CASE WHEN i.paid_amount<i.amount THEN greatest(0,day_number(@date)-day_number(i.due_date)) ELSE 0 END) AS days,
    SUM(CASE WHEN f.status<>'waived' THEN greatest(0,f.amount-f.paid_amount) ELSE 0 END) AS fees
    FROM scoped_loans l JOIN scoped_installments i ON i.loan_id=l.id LEFT JOIN scoped_late_fees f ON f.installment_id=i.id
    WHERE l.status IN ('active','overdue') GROUP BY l.id, l.client_id, l.principal_amount, l.interest_percentage, l.interest_amount, l.total_amount, l.installment_count, l.late_fee_per_day, l.loan_date, l.first_due_date, l.status, l.notes, l.created_by, l.revision, l.created_at, l.updated_at, l.company_id)
    SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN days=0 AND COALESCE(fees,0)=0 THEN 1 ELSE 0 END),0) AS regular,
      COALESCE(SUM(CASE WHEN days<=@attention AND (days>0 OR fees>0) THEN 1 ELSE 0 END),0) AS attention,
      COALESCE(SUM(CASE WHEN days>@attention THEN 1 ELSE 0 END),0) AS overdue FROM balances`,
    )
    .get({ date, attention }));
}

export async function upcoming(date) {
  return (await database()
    .prepare(
      `SELECT i.id,l.id AS loan_id,c.name,i.due_date FROM scoped_installments i
    JOIN scoped_loans l ON l.id=i.loan_id JOIN scoped_clients c ON c.id=l.client_id
    WHERE l.status<>'cancelled' AND i.paid_amount<i.amount AND i.due_date>=?
    ORDER BY i.due_date,i.id LIMIT 3`,
    )
    .all(date));
}

const interestAllocation = `WITH allocation AS (
  SELECT i.*, l.client_id, l.interest_amount, l.total_amount,
    COALESCE(SUM(i.amount) OVER (PARTITION BY i.loan_id ORDER BY i.installment_number ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS before_amount
  FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id WHERE l.status<>'cancelled'
), interest_allocation AS (
  SELECT i.*, money_share(i.before_amount+i.amount,i.interest_amount,i.total_amount)-money_share(i.before_amount,i.interest_amount,i.total_amount) AS interest_share
  FROM allocation i
)`;

const reportRows = `${interestAllocation}, financial AS (
  SELECT i.*,
    CASE WHEN f.status='waived' THEN 0 ELSE COALESCE(f.amount,0) END AS fee,
    COALESCE(f.paid_amount,0) AS fee_paid,
    (SELECT MAX(payment_date) FROM scoped_payments p WHERE p.installment_id=i.id AND p.voided_at IS NULL) AS payment_date
  FROM interest_allocation i LEFT JOIN scoped_late_fees f ON f.installment_id=i.id WHERE i.due_date BETWEEN @start AND @end
), rows AS (
  SELECT i.id,c.name AS client,i.loan_id AS "contractId",i.due_date AS date,i.payment_date AS "paymentDate",
    i.amount+i.fee AS expected,i.paid_amount+i.fee_paid AS received,
    greatest(0,i.amount+i.fee-i.paid_amount-i.fee_paid) AS pending,
    i.interest_share AS "expectedInterest",i.interest_share+i.fee AS "expectedProfit",
    money_share(i.paid_amount,i.interest_share,i.amount)+i.fee_paid AS "realizedProfit",
    CASE WHEN i.paid_amount>=i.amount AND i.fee_paid>=i.fee THEN 'paid'
      WHEN i.paid_amount+i.fee_paid>0 THEN 'partial' ELSE 'unpaid' END AS status,
    CASE WHEN i.paid_amount<i.amount OR i.fee_paid<i.fee THEN greatest(0,CAST(day_number(@today)-day_number(i.due_date) AS INTEGER)) ELSE 0 END AS "daysLate",
    i.installment_number AS "installmentNumber",
    CASE WHEN i.paid_amount<i.amount THEN greatest(0,CAST(day_number(@today)-day_number(i.due_date) AS INTEGER)) ELSE 0 END AS "installmentDaysLate",
    CASE WHEN i.fee>i.fee_paid THEN 1 ELSE 0 END AS "feePending",
    i.fee AS "lateFee" FROM financial i JOIN scoped_clients c ON c.id=i.client_id
  )`;

export async function monthlyReport(start, end, date) {
  const db = database();
  const installments = (await db.prepare(`${reportRows} SELECT * FROM rows ORDER BY date,id`)
    .all({ start, end, today: date }));
  const contracts = (await db.prepare(`SELECT l.id,c.name AS client,l.principal_amount AS amount,l.loan_date AS date
    FROM scoped_loans l JOIN scoped_clients c ON c.id=l.client_id
    WHERE l.status<>'cancelled' AND l.loan_date BETWEEN ? AND ? ORDER BY l.loan_date DESC,l.id DESC`)
    .all(start, end));
  const cash = (await db.prepare(`${interestAllocation}, payment_allocation AS (
    SELECT p.*,i.interest_share,i.amount AS installment_amount,
      SUM(p.amount) OVER (PARTITION BY p.installment_id ORDER BY p.payment_date,p.id) AS cumulative_amount
    FROM scoped_payments p JOIN interest_allocation i ON i.id=p.installment_id WHERE p.voided_at IS NULL
  ) SELECT COALESCE(SUM(amount+late_fee_amount),0) AS received,
    COALESCE(SUM(late_fee_amount),0) AS "receivedLateFees",
    COALESCE(SUM(money_share(cumulative_amount,interest_share,installment_amount)
      -money_share(cumulative_amount-amount,interest_share,installment_amount)+late_fee_amount),0) AS "realizedProfit"
    FROM payment_allocation WHERE payment_date BETWEEN ? AND ?`).get(start, end));
  return { installments, contracts, cash };
}

export async function report(query, date) {
  const params = { start: query.start, end: query.end, today: date };
  const summary = (await database()
    .prepare(
      `${reportRows} SELECT COUNT(*) AS count,COALESCE(SUM(expected),0) AS expected,
    COALESCE(SUM(received),0) AS received,COALESCE(SUM(pending),0) AS pending,
    COALESCE(SUM("expectedProfit"),0) AS "expectedProfit",COALESCE(SUM("realizedProfit"),0) AS "realizedProfit",
    COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END),0) AS paid,COALESCE(SUM(CASE WHEN status='partial' THEN 1 ELSE 0 END),0) AS partial,COALESCE(SUM(CASE WHEN status='unpaid' THEN 1 ELSE 0 END),0) AS unpaid,
    COUNT(DISTINCT CASE WHEN pending>0 THEN "contractId" END) AS "pendingContracts" FROM rows`,
    )
    .get(params));
  const pending = (await database()
    .prepare(
      `${reportRows} SELECT * FROM rows WHERE pending>0 ORDER BY "daysLate" DESC,id LIMIT 10`,
    )
    .all(params));
  const where = `WHERE (@status='all' OR status=@status) AND (ascii_lower(client) LIKE ascii_lower(@search) ESCAPE '!' OR ascii_lower(CAST("contractId" AS TEXT)) LIKE ascii_lower(@search) ESCAPE '!'
    OR ascii_lower(date) LIKE ascii_lower(@search) ESCAPE '!' OR ascii_lower(COALESCE("paymentDate",'')) LIKE ascii_lower(@search) ESCAPE '!')`;
  const filtered = {
    ...params,
    status: query.status,
    search: `%${query.search.replaceAll('!', '!!')}%`,
  };
  const total = (await database()
    .prepare(`${reportRows} SELECT COUNT(*) AS total FROM rows ${where}`)
    .get(filtered)).total;
  const sorts = {
    client: "ascii_lower(client)",
    contractId: "\"contractId\"",
    date: "date",
    expected: "expected",
    received: "received",
    pending: "pending",
    paymentDate: "\"paymentDate\"",
    status: "CASE status WHEN 'paid' THEN 1 WHEN 'partial' THEN 2 ELSE 3 END",
  };
  const sort = sorts[query.sort];
  const direction = query.direction === "desc" ? "DESC" : "ASC";
  const items = (await database()
    .prepare(
      `${reportRows} SELECT * FROM rows ${where} ORDER BY ${sort} ${direction} NULLS ${direction === "ASC" ? "FIRST" : "LAST"},id LIMIT @limit OFFSET @offset`,
    )
    .all({ ...filtered, limit: query.limit, offset: query.offset }));
  return { summary, pending, items, total };
}

export async function notifications(date, includeActivity = false) {
  return (await database()
    .prepare(
      `SELECT * FROM (
    SELECT 'payment-'||p.id AS id,'payment' AS type,c.name AS customer,p.amount+p.late_fee_amount AS amount,
      i.installment_number||'/'||l.installment_count AS installment,p.created_at AS datetime,0 AS days_late,
      COALESCE((SELECT a.actor_name FROM scoped_auth_audit_logs a WHERE a.entity_type='payment' AND a.entity_id=p.id
        AND a.event IN ('payment_created','payment_corrected') ORDER BY a.id LIMIT 1),u.name) AS responsible
    FROM scoped_payments p JOIN scoped_installments i ON i.id=p.installment_id JOIN scoped_loans l ON l.id=i.loan_id JOIN scoped_clients c ON c.id=l.client_id
    LEFT JOIN users u ON u.id=p.created_by
    WHERE p.voided_at IS NULL AND (@includeActivity=0 OR NOT EXISTS
      (SELECT 1 FROM scoped_auth_audit_logs a WHERE a.entity_type='payment' AND a.entity_id=p.id AND a.event IN ('payment_created','payment_corrected')))
    UNION ALL
    SELECT 'overdue-'||i.id,'overdue',c.name,i.amount-i.paid_amount,i.installment_number||'/'||l.installment_count,
      i.due_date||'T12:00:00Z',CAST(day_number(@date)-day_number(i.due_date) AS INTEGER),NULL
    FROM scoped_installments i JOIN scoped_loans l ON l.id=i.loan_id JOIN scoped_clients c ON c.id=l.client_id
    WHERE l.status<>'cancelled' AND i.paid_amount<i.amount AND i.due_date<@date
  ) AS notices ORDER BY datetime DESC LIMIT 50`,
    )
    .all({ date,includeActivity:Number(includeActivity) }));
}

export async function actionNotifications(includeActivity = true) {
  return (await database().prepare(`SELECT id,event,actor_id,actor_name,entity_type,entity_id,details,created_at
    FROM scoped_auth_audit_logs WHERE entity_type='loan' OR (@includeActivity=1 AND entity_type IN ('client','payment'))
    ORDER BY id DESC LIMIT 100`).all({ includeActivity: Number(includeActivity) }))
    .map((row) => ({...JSON.parse(row.details),id:`action-${row.id}`,event:row.event,
      type:{client:'registration',loan:'loan',payment:'payment'}[row.entity_type],
      entityId:row.entity_id,...(includeActivity ? {responsibleId:row.actor_id,responsible:row.actor_name} : {}),
      datetime:new Date(row.created_at).toISOString(),days_late:0}));
}
