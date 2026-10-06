// Called inside the existing initialization transaction, before access guards.
export function migrateClientCompanies(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS client_companies (
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    PRIMARY KEY (client_id, company_id)
  );
  CREATE INDEX IF NOT EXISTS idx_client_companies_company ON client_companies(company_id, client_id);
  INSERT INTO client_companies(client_id, company_id)
  SELECT DISTINCT client_id, company_id FROM loans WHERE company_id IS NOT NULL
  ON CONFLICT(client_id, company_id) DO NOTHING;`);
}
