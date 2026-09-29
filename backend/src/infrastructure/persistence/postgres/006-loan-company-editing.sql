-- Keep ownership changes restricted to administrators, including direct writes.
CREATE FUNCTION guard_loan_company_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.company_id IS DISTINCT FROM OLD.company_id
    AND NOT COALESCE(NULLIF(current_setting('paytrack.access',true),'')::jsonb->>'role'='admin',false) THEN
  RAISE EXCEPTION 'Loan company is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER loans_company_immutable ON loans;
CREATE TRIGGER loans_company_immutable BEFORE UPDATE OF company_id ON loans
FOR EACH ROW EXECUTE FUNCTION guard_loan_company_change();
