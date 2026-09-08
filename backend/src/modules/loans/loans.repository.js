import { database } from "../../config/database.js";

const select = `SELECT l.*, c.name AS client_name, c.cpf AS client_cpf,
  MIN(i.amount) AS min_installment_amount, MAX(i.amount) AS max_installment_amount,
  COUNT(CASE WHEN i.status='paid' THEN 1 END) AS paid_installments,
  COALESCE(SUM(i.paid_amount),0) AS paid_amount,
  COALESCE(SUM(CASE WHEN f.status<>'waived' THEN MAX(0,f.amount-f.paid_amount) ELSE 0 END),0) AS fee_remaining,
  COALESCE(MAX(CASE WHEN i.paid_amount<i.amount THEN MAX(0,CAST(julianday(@date)-julianday(i.due_date) AS INTEGER)) ELSE 0 END),0) AS days_late
  FROM loans l JOIN clients c ON c.id=l.client_id
  LEFT JOIN installments i ON i.loan_id=l.id LEFT JOIN late_fees f ON f.installment_id=i.id`;

export function findLoan(id, date) {
  return database()
    .prepare(`${select} WHERE l.id=@id GROUP BY l.id`)
    .get({ id, date });
}

export function listLoans(
  { search, status, client_id, limit, offset },
  date,
  attention,
) {
  const query = `WITH loan_rows AS (${select} WHERE (c.name LIKE @search OR CAST(l.id AS TEXT)=@term OR c.cpf LIKE @document)
    AND (@client IS NULL OR l.client_id=@client) GROUP BY l.id),
    rows AS (SELECT *, CASE WHEN status IN ('paid','cancelled') THEN status WHEN days_late>@attention THEN 'overdue'
      WHEN days_late>0 OR fee_remaining>0 THEN 'attention' ELSE 'on-time' END AS display_status FROM loan_rows)
    SELECT * FROM rows WHERE (@status IS NULL OR display_status=@status OR (@status='active' AND status IN ('active','overdue')))`;
  const params = {
    search: `%${search}%`,
    term: search,
    document: `%${search.replace(/[.\-\s]/g, "")}%`,
    status: status ?? null,
    client: client_id ?? null,
    date,
    attention,
  };
  const total = database()
    .prepare(`SELECT COUNT(*) AS total FROM (${query})`)
    .get(params).total;
  const items = database()
    .prepare(`${query} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });
  return { items, total };
}

export function insertLoan(data) {
  return Number(
    database()
      .prepare(
        `INSERT INTO loans (client_id, principal_amount, interest_percentage, interest_amount,
    total_amount, installment_count, late_fee_per_day, loan_date, first_due_date, notes)
    VALUES (@client_id,@principal_amount,@interest_percentage,@interest_amount,@total_amount,@installment_count,
      @late_fee_per_day,@loan_date,@first_due_date,@notes)`,
      )
      .run(data).lastInsertRowid,
  );
}

export function updateLoan(id, notes, status) {
  database()
    .prepare(
      "UPDATE loans SET notes=?, status=?, revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .run(notes, status, id);
}

export function bumpRevision(id) {
  database()
    .prepare(
      "UPDATE loans SET revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .run(id);
}

export function hasReceipts(id) {
  return database()
    .prepare(
      "SELECT 1 FROM payments p JOIN installments i ON i.id=p.installment_id WHERE i.loan_id=? LIMIT 1",
    )
    .get(id);
}
