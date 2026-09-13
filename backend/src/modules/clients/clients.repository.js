import { database } from "../../config/database.js";

export function findClient(id) {
  return database().prepare("SELECT * FROM scoped_clients WHERE id = ?").get(id);
}

export function findDuplicate({ cpf, rg, cnh, company_id }, exceptId = 0) {
  return database()
    .prepare(
      "SELECT cpf, rg, cnh FROM scoped_clients WHERE company_id = ? AND id <> ? AND (cpf = ? OR rg = ? OR cnh = ?)",
    )
    .all(company_id, exceptId, cpf, rg ?? null, cnh ?? null);
}

export function listClients({ search, status, company_id, limit, offset }) {
  const where = `WHERE (c.name LIKE @search OR c.cpf LIKE @document)
    AND (@status IS NULL OR c.status = @status) AND (@company IS NULL OR c.company_id=@company)`;
  const params = {
    search: `%${search}%`,
    document: `%${search.replace(/[.\-\s]/g, "")}%`,
    status: status ?? null,
    company: company_id ?? null,
  };
  const total = database()
    .prepare(`SELECT COUNT(*) AS total FROM scoped_clients c ${where}`)
    .get(params).total;
  const items = database()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM scoped_loans WHERE client_id = c.id) AS loan_count
    FROM scoped_clients c ${where} ORDER BY c.id DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset });
  return { items, total };
}

export function insertClient(client, actorId = null) {
  return Number(
    database()
      .prepare(
        `INSERT INTO clients (company_id, name, cpf, rg, cnh, phone, email, notes, created_by)
    VALUES (@company_id, @name, @cpf, @rg, @cnh, @phone, @email, @notes, @actorId)`,
      )
      .run({...client,actorId}).lastInsertRowid,
  );
}

export function updateClient(client) {
  database()
    .prepare(
      `UPDATE clients SET name=@name, cpf=@cpf, rg=@rg, cnh=@cnh, phone=@phone,
    email=@email, notes=@notes, status_override=@status_override, updated_at=CURRENT_TIMESTAMP WHERE id=@id`,
    )
    .run(client);
}

export function clientHistory(id) {
  return database()
    .prepare(
      `SELECT l.*, MAX(i.paid_at) AS paid_at FROM scoped_loans l
    LEFT JOIN scoped_installments i ON i.loan_id = l.id WHERE l.client_id = ? GROUP BY l.id ORDER BY l.id DESC`,
    )
    .all(id);
}
