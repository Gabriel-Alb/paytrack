ALTER TABLE user_companies ADD COLUMN role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','MANAGER'));
CREATE TABLE user_access_companies (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    company_role TEXT CHECK(company_role IN ('USER','MANAGER')),
    decided_by BIGINT REFERENCES users(id),
    decided_at TEXT,
    PRIMARY KEY(user_id,company_id),
    CHECK ((status='pending' AND company_role IS NULL AND decided_by IS NULL AND decided_at IS NULL)
      OR (status='approved' AND company_role IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
      OR (status='rejected' AND company_role IS NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE INDEX idx_user_access_company ON user_access_companies(company_id,status,user_id);
CREATE INDEX idx_user_access_actor ON user_access_companies(decided_by);
