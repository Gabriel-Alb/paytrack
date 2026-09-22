ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1));
ALTER TABLE users ADD COLUMN temporary_password_expires_at BIGINT;
CREATE TABLE password_reset_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','rejected','expired')),
    requested_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    resolved_at BIGINT,
    resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_password_reset_pending ON password_reset_requests(user_id) WHERE status='pending';
CREATE INDEX idx_password_reset_status ON password_reset_requests(status,id);
CREATE INDEX idx_password_reset_user ON password_reset_requests(user_id);
CREATE INDEX idx_password_reset_resolver ON password_reset_requests(resolved_by);
