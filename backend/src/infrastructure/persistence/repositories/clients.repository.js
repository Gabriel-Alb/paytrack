import { database } from "../connection.js";

export async function findClient(id) {
  const client = await database().prepare("SELECT * FROM scoped_clients WHERE id = ?").get(id);
  return client ? (await withCompanies([client]))[0] : undefined;
}

async function withCompanies(clients) {
  if (!clients.length) return clients;
  const companies = await database().prepare(`SELECT cc.client_id, c.id, c.name
    FROM client_companies cc JOIN companies c ON c.id=cc.company_id
    WHERE cc.client_id IN (${clients.map(() => '?').join(',')}) AND can_access_company(c.id)
    ORDER BY c.name, c.id`).all(...clients.map(client => client.id));
  return clients.map(client => {
    const links = companies.filter(company => company.client_id === client.id).map(({id,name}) => ({id,name}));
    return {...client, companies:links, companyIds:links.map(company => company.id)};
  });
}

export async function clientHasCompany(id, companyId) {
  return Boolean(await database().prepare('SELECT 1 FROM client_companies WHERE client_id=? AND company_id=? AND can_access_company(company_id)').get(id, companyId));
}

export async function replaceClientCompanies(id, companyIds) {
  // Keep existing links used by financial history. The service authorizes this action.
  const placeholders = companyIds.map(() => '?').join(',');
  const used = await database().prepare(`SELECT 1 FROM loans WHERE client_id=? AND company_id NOT IN (${placeholders}) LIMIT 1`).get(id, ...companyIds);
  if (used) return false;
  await database().prepare(`DELETE FROM client_companies WHERE client_id=? AND company_id NOT IN (${placeholders})`).run(id, ...companyIds);
  for (const companyId of companyIds) {
    await database().prepare('INSERT INTO client_companies(client_id, company_id) VALUES(?, ?) ON CONFLICT(client_id, company_id) DO NOTHING').run(id, companyId);
  }
  return true;
}

export async function findDuplicate({ cpf, rg, cnh }, exceptId = 0) {
  return (await database()
    .prepare(
      "SELECT cpf, rg, cnh FROM scoped_clients WHERE id <> ? AND (cpf = ? OR rg = ? OR cnh = ?)",
    )
    .all(exceptId, cpf, rg ?? null, cnh ?? null));
}

export async function listClients({ search, status, company_id, limit, offset }) {
  const where = `WHERE (ascii_lower(c.name) LIKE ascii_lower(@search) ESCAPE '!' OR ascii_lower(c.cpf) LIKE ascii_lower(@document) ESCAPE '!')
    AND (CAST(@status AS TEXT) IS NULL OR c.status = @status) AND (CAST(@company AS BIGINT) IS NULL OR EXISTS(SELECT 1 FROM client_companies cc WHERE cc.client_id=c.id AND cc.company_id=@company AND can_access_company(cc.company_id)))`;
  const params = {
    search: `%${search.replaceAll('!', '!!')}%`,
    document: `%${search.replace(/[.\-\s]/g, "").replaceAll("!", "!!")}%`,
    status: status ?? null,
    company: company_id ?? null,
  };
  const total = (await database()
    .prepare(`SELECT COUNT(*) AS total FROM scoped_clients c ${where}`)
    .get(params)).total;
  const items = (await database()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM scoped_loans WHERE client_id = c.id) AS loan_count
    FROM scoped_clients c ${where} ORDER BY c.id DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }));
  return { items:await withCompanies(items), total };
}

export async function insertClient(client, actorId = null) {
  return Number(
    (await database()
      .prepare(
        `INSERT INTO clients (name, cpf, rg, cnh, phone, email, notes, created_by)
    VALUES (@name, @cpf, @rg, @cnh, @phone, @email, @notes, @actorId)`,
      )
      .run({...client,actorId})).lastInsertRowid,
  );
}

export async function updateClient(client) {
  (await database()
    .prepare(
      `UPDATE clients SET name=@name, cpf=@cpf, rg=@rg, cnh=@cnh, phone=@phone,
    email=@email, notes=@notes, status_override=@status_override, updated_at=utc_now() WHERE id=@id`,
    )
    .run(client));
}

export async function clientHistory(id) {
  return (await database()
    .prepare(
      `SELECT l.*, MAX(i.paid_at) AS paid_at FROM scoped_loans l
    LEFT JOIN scoped_installments i ON i.loan_id = l.id WHERE l.client_id = ? GROUP BY l.id, l.client_id, l.principal_amount, l.interest_percentage, l.interest_amount, l.total_amount, l.installment_count, l.late_fee_per_day, l.loan_date, l.first_due_date, l.status, l.notes, l.created_by, l.revision, l.created_at, l.updated_at, l.company_id ORDER BY l.id DESC`,
    )
    .all(id));
}
