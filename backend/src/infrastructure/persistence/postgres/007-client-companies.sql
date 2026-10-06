-- Add associations without rewriting any existing customer or financial record.
CREATE TABLE IF NOT EXISTS client_companies (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  PRIMARY KEY (client_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_client_companies_company ON client_companies(company_id, client_id);
INSERT INTO client_companies(client_id, company_id)
SELECT DISTINCT client_id, company_id FROM loans WHERE company_id IS NOT NULL
ON CONFLICT (client_id, company_id) DO NOTHING;

CREATE OR REPLACE VIEW scoped_clients AS SELECT c.* FROM clients c
WHERE COALESCE(NULLIF(current_setting('paytrack.access',true),'')::jsonb->>'role'='admin',false)
  OR EXISTS(SELECT 1 FROM client_companies cc WHERE cc.client_id=c.id AND can_access_company(cc.company_id));

CREATE OR REPLACE FUNCTION guard_clients() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM scoped_clients WHERE id=OLD.id) THEN
  RAISE EXCEPTION 'Company access denied' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_clients BEFORE UPDATE OR DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION guard_clients();
