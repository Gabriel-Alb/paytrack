import { database } from "../connection.js";

const groupBy = 'l.id, l.client_id, l.principal_amount, l.interest_percentage, l.interest_amount, l.total_amount, l.installment_count, l.late_fee_per_day, l.loan_date, l.first_due_date, l.status, l.notes, l.created_by, l.revision, l.created_at, l.updated_at, l.company_id, c.name, c.cpf';

const select = `SELECT l.*, c.name AS client_name, c.cpf AS client_cpf,
  MIN(i.amount) AS min_installment_amount, MAX(i.amount) AS max_installment_amount,
  COUNT(CASE WHEN i.status='paid' THEN 1 END) AS paid_installments,
  COALESCE(SUM(i.paid_amount),0) AS paid_amount,
  COALESCE(SUM(CASE WHEN f.status<>'waived' THEN greatest(0,f.amount-f.paid_amount) ELSE 0 END),0) AS fee_remaining,
  COALESCE(MAX(CASE WHEN i.paid_amount<i.amount THEN greatest(0,CAST(day_number(@date)-day_number(i.due_date) AS INTEGER)) ELSE 0 END),0) AS days_late
  FROM scoped_loans l JOIN scoped_clients c ON c.id=l.client_id
  LEFT JOIN scoped_installments i ON i.loan_id=l.id LEFT JOIN scoped_late_fees f ON f.installment_id=i.id`;

export async function findLoan(id, date) {
  return (await database()
    .prepare(`${select} WHERE l.id=@id GROUP BY ${groupBy}`)
    .get({ id, date }));
}

export async function loansDueInPeriod(start, end, date) {
  return (await database().prepare(`${select} WHERE l.status<>'cancelled' AND EXISTS (
    SELECT 1 FROM scoped_installments due WHERE due.loan_id=l.id AND due.due_date BETWEEN @start AND @end
  ) GROUP BY ${groupBy} ORDER BY days_late DESC,l.id DESC`).all({ start, end, date }));
}

export async function listLoans(
  { search, status, client_id, company_id, limit, offset },
  date,
  attention,
) {
  const query = `WITH loan_rows AS (${select} WHERE (ascii_lower(c.name) LIKE ascii_lower(@search) ESCAPE '!' OR CAST(l.id AS TEXT)=@term OR ascii_lower(c.cpf) LIKE ascii_lower(@document) ESCAPE '!')
    AND (CAST(@client AS BIGINT) IS NULL OR l.client_id=@client) AND (CAST(@company AS BIGINT) IS NULL OR l.company_id=@company) GROUP BY ${groupBy}),
    rows AS (SELECT *, CASE WHEN status IN ('paid','cancelled') THEN status WHEN days_late>@attention THEN 'overdue'
      WHEN days_late>0 OR fee_remaining>0 THEN 'attention' ELSE 'on-time' END AS display_status FROM loan_rows)
    SELECT * FROM rows WHERE (CAST(@status AS TEXT) IS NULL OR display_status=@status OR (@status='active' AND status IN ('active','overdue')))`;
  const params = {
    search: `%${search.replaceAll('!', '!!')}%`,
    term: search,
    document: `%${search.replace(/[.\-\s]/g, "").replaceAll("!", "!!")}%`,
    status: status ?? null,
    client: client_id ?? null,
    company: company_id ?? null,
    date,
    attention,
  };
  const total = (await database()
    .prepare(`SELECT COUNT(*) AS total FROM (${query}) AS filtered_loans`)
    .get(params)).total;
  const items = (await database()
    .prepare(`${query} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset }));
  return { items, total };
}

export async function insertLoan(data, actorId = null) {
  return Number(
    (await database()
      .prepare(
        `INSERT INTO loans (client_id, principal_amount, interest_percentage, interest_amount,
    total_amount, installment_count, late_fee_per_day, loan_date, first_due_date, notes, created_by)
    VALUES (@client_id,@principal_amount,@interest_percentage,@interest_amount,@total_amount,@installment_count,
      @late_fee_per_day,@loan_date,@first_due_date,@notes,@actorId)`,
      )
      .run({...data,actorId})).lastInsertRowid,
  );
}

export async function updateLoan(id, notes, status) {
  (await database()
    .prepare(
      "UPDATE loans SET notes=?, status=?, revision=revision+1, updated_at=utc_now() WHERE id=?",
    )
    .run(notes, status, id));
}

export async function bumpRevision(id) {
  (await database()
    .prepare(
      "UPDATE loans SET revision=revision+1, updated_at=utc_now() WHERE id=?",
    )
    .run(id));
}

export async function hasReceipts(id) {
  return (await database()
    .prepare(
      "SELECT 1 FROM scoped_payments p JOIN scoped_installments i ON i.id=p.installment_id WHERE i.loan_id=? LIMIT 1",
    )
    .get(id));
}
