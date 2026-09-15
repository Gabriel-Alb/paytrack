-- Move ownership before removing the legacy client association. No records are merged.
DROP VIEW scoped_auth_audit_logs;
DROP VIEW scoped_payments;
DROP VIEW scoped_late_fees;
DROP VIEW scoped_installments;
DROP VIEW scoped_loans;
DROP VIEW scoped_clients;
DROP TRIGGER guard_clients ON clients;
DROP TRIGGER clients_company_immutable ON clients;
DROP TRIGGER guard_loans ON loans;
ALTER TABLE loans ADD COLUMN company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT;
UPDATE loans l SET company_id=c.company_id FROM clients c WHERE c.id=l.client_id;
ALTER TABLE loans ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE clients DROP COLUMN company_id;
CREATE INDEX idx_loans_company ON loans(company_id,status);
CREATE TRIGGER loans_company_immutable BEFORE UPDATE OF company_id ON loans
FOR EACH ROW EXECUTE FUNCTION preserve_financial_owner('company_id');
CREATE VIEW scoped_clients AS SELECT * FROM clients;
CREATE VIEW scoped_loans AS SELECT * FROM loans WHERE can_access_company(company_id);
CREATE VIEW scoped_installments AS SELECT i.* FROM installments i JOIN scoped_loans l ON l.id=i.loan_id;
CREATE VIEW scoped_payments AS SELECT p.* FROM payments p JOIN scoped_installments i ON i.id=p.installment_id;
CREATE VIEW scoped_late_fees AS SELECT f.* FROM late_fees f JOIN scoped_installments i ON i.id=f.installment_id;
CREATE VIEW scoped_auth_audit_logs AS SELECT a.* FROM auth_audit_logs a WHERE
 (a.entity_type='client' AND a.entity_id IN (SELECT id FROM scoped_clients)) OR
 (a.entity_type='loan' AND a.entity_id IN (SELECT id FROM scoped_loans)) OR
 (a.entity_type='payment' AND a.entity_id IN (SELECT id FROM scoped_payments));
CREATE OR REPLACE FUNCTION guard_loans() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' AND NOT can_access_company(OLD.company_id) THEN
  RAISE EXCEPTION 'Company access denied' USING ERRCODE='23514';
 END IF;
 IF TG_OP<>'DELETE' AND NOT can_access_company(NEW.company_id) THEN
  RAISE EXCEPTION 'Company access denied' USING ERRCODE='23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_loans BEFORE INSERT OR UPDATE OR DELETE ON loans
FOR EACH ROW EXECUTE FUNCTION guard_loans();

CREATE INDEX idx_clients_cpf ON clients(cpf);
CREATE FUNCTION clients_cpf_unique() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(728194001);
 IF TG_OP='UPDATE' AND NEW.cpf IS NOT DISTINCT FROM OLD.cpf THEN RETURN NEW; END IF;
 IF NEW.cpf IS NOT NULL AND EXISTS(SELECT 1 FROM clients WHERE cpf=NEW.cpf AND id<>NEW.id) THEN
  RAISE EXCEPTION 'Duplicate client document' USING ERRCODE='23505', CONSTRAINT='clients_cpf_unique';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clients_cpf_unique BEFORE INSERT OR UPDATE OF cpf ON clients
FOR EACH ROW EXECUTE FUNCTION clients_cpf_unique();

CREATE INDEX idx_clients_rg ON clients(rg);
CREATE FUNCTION clients_rg_unique() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(728194001);
 IF TG_OP='UPDATE' AND NEW.rg IS NOT DISTINCT FROM OLD.rg THEN RETURN NEW; END IF;
 IF NEW.rg IS NOT NULL AND EXISTS(SELECT 1 FROM clients WHERE rg=NEW.rg AND id<>NEW.id) THEN
  RAISE EXCEPTION 'Duplicate client document' USING ERRCODE='23505', CONSTRAINT='clients_rg_unique';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clients_rg_unique BEFORE INSERT OR UPDATE OF rg ON clients
FOR EACH ROW EXECUTE FUNCTION clients_rg_unique();

CREATE INDEX idx_clients_cnh ON clients(cnh);
CREATE FUNCTION clients_cnh_unique() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(728194001);
 IF TG_OP='UPDATE' AND NEW.cnh IS NOT DISTINCT FROM OLD.cnh THEN RETURN NEW; END IF;
 IF NEW.cnh IS NOT NULL AND EXISTS(SELECT 1 FROM clients WHERE cnh=NEW.cnh AND id<>NEW.id) THEN
  RAISE EXCEPTION 'Duplicate client document' USING ERRCODE='23505', CONSTRAINT='clients_cnh_unique';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clients_cnh_unique BEFORE INSERT OR UPDATE OF cnh ON clients
FOR EACH ROW EXECUTE FUNCTION clients_cnh_unique();
