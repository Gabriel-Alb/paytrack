import { database } from "../../config/database.js";

export function findClient(id) {
  return database().prepare("SELECT * FROM clients WHERE id = ?").get(id);
}

export function findDuplicate({ cpf, rg, cnh }, exceptId = 0) {
  return database()
    .prepare(
      "SELECT cpf, rg, cnh FROM clients WHERE id <> ? AND (cpf = ? OR rg = ? OR cnh = ?)",
    )
    .all(exceptId, cpf, rg ?? null, cnh ?? null);
}

export function listClients({ search, status, limit, offset }) {
  const where = `WHERE (c.name LIKE @search OR c.cpf LIKE @document)
    AND (@status IS NULL OR c.status = @status)`;
  const params = {
    search: `%${search}%`,
    document: `%${search.replace(/[.\-\s]/g, "")}%`,
    status: status ?? null,
  };
  const total = database()
    .prepare(`SELECT COUNT(*) AS total FROM clients c ${where}`)
    .get(params).total;
  const items = database()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM loans WHERE client_id = c.id) AS loan_count
    FROM clients c ${where} ORDER BY c.id DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset });
  return { items, total };
}

export function insertClient(client, actorId = null) {
  return Number(
    database()
      .prepare(
        `INSERT INTO clients (name, cpf, rg, cnh, phone, email, notes, created_by)
    VALUES (@name, @cpf, @rg, @cnh, @phone, @email, @notes, @actorId)`,
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
      `SELECT l.*, MAX(i.paid_at) AS paid_at FROM loans l
    LEFT JOIN installments i ON i.loan_id = l.id WHERE l.client_id = ? GROUP BY l.id ORDER BY l.id DESC`,
    )
    .all(id);
}
