ALTER TABLE late_fees ADD COLUMN waived_amount BIGINT NOT NULL DEFAULT 0 CHECK (waived_amount >= 0);
UPDATE late_fees SET waived_amount=greatest(0,amount-paid_amount) WHERE status='waived';

-- SELECT * in PostgreSQL views is expanded when the view is created.
CREATE OR REPLACE VIEW scoped_late_fees AS
  SELECT f.* FROM late_fees f JOIN scoped_installments i ON i.id=f.installment_id;
