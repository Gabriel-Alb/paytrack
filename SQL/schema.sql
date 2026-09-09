PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    cpf TEXT UNIQUE,
    rg TEXT UNIQUE,
    cnh TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('master', 'user')),
    access_status TEXT NOT NULL DEFAULT 'pending' CHECK(access_status IN ('pending','active','rejected','blocked')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    rejected_at TEXT,
    blocked_at TEXT,
    password_changed_at TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id INTEGER PRIMARY KEY,
    event TEXT NOT NULL,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subject_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key TEXT PRIMARY KEY,
    hits INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_expiry ON auth_rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_users_access ON users(access_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized ON users(lower(trim(email)));
CREATE TRIGGER IF NOT EXISTS users_role_insert BEFORE INSERT ON users
WHEN NEW.role NOT IN ('master','user') BEGIN SELECT RAISE(ABORT, 'Invalid role'); END;
CREATE TRIGGER IF NOT EXISTS users_role_update BEFORE UPDATE OF role ON users
WHEN NEW.role NOT IN ('master','user') BEGIN SELECT RAISE(ABORT, 'Invalid role'); END;
CREATE TRIGGER IF NOT EXISTS protect_last_master_update BEFORE UPDATE OF role,access_status ON users
WHEN OLD.role='master' AND OLD.access_status='active'
 AND (NEW.role<>'master' OR NEW.access_status<>'active')
 AND (SELECT count(*) FROM users WHERE role='master' AND access_status='active')<=1
BEGIN SELECT RAISE(ABORT, 'Last active master'); END;
CREATE TRIGGER IF NOT EXISTS protect_last_master_delete BEFORE DELETE ON users
WHEN OLD.role='master' AND OLD.access_status='active'
 AND (SELECT count(*) FROM users WHERE role='master' AND access_status='active')<=1
BEGIN SELECT RAISE(ABORT, 'Last active master'); END;

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    rg TEXT UNIQUE,
    cnh TEXT UNIQUE,
    phone TEXT,
    email TEXT COLLATE NOCASE,
    status TEXT NOT NULL DEFAULT 'sem_contrato'
        CHECK (status IN ('sem_contrato', 'ativo', 'quitado', 'negativado')),
    notes TEXT,
    created_by INTEGER,
    status_override TEXT CHECK (status_override IS NULL OR status_override = 'negativado'),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    principal_amount INTEGER NOT NULL CHECK (principal_amount > 0),
    interest_percentage NUMERIC NOT NULL DEFAULT 0 CHECK (interest_percentage >= 0),
    interest_amount INTEGER NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
    total_amount INTEGER NOT NULL CHECK (total_amount > 0),
    installment_count INTEGER NOT NULL CHECK (installment_count > 0),
    late_fee_per_day INTEGER NOT NULL DEFAULT 0 CHECK (late_fee_per_day >= 0),
    loan_date TEXT NOT NULL,
    first_due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paid', 'overdue', 'cancelled')),
    notes TEXT,
    created_by INTEGER,
    revision INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    amount INTEGER NOT NULL CHECK (amount > 0),
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
    paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (loan_id, installment_number),
    FOREIGN KEY (loan_id) REFERENCES loans(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    installment_id INTEGER NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    late_fee_amount INTEGER NOT NULL DEFAULT 0 CHECK (late_fee_amount >= 0),
    payment_date TEXT NOT NULL,
    payment_method TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    voided_at TEXT,
    CHECK (amount > 0 OR late_fee_amount > 0),
    FOREIGN KEY (installment_id) REFERENCES installments(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS late_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    installment_id INTEGER NOT NULL UNIQUE,
    days_late INTEGER NOT NULL DEFAULT 0 CHECK (days_late >= 0),
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'partial', 'paid', 'waived')),
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (installment_id) REFERENCES installments(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clients_status
    ON clients(status);

CREATE INDEX IF NOT EXISTS idx_loans_client_id
    ON loans(client_id);

CREATE INDEX IF NOT EXISTS idx_loans_status
    ON loans(status);

CREATE INDEX IF NOT EXISTS idx_installments_loan_id
    ON installments(loan_id);

CREATE INDEX IF NOT EXISTS idx_installments_status
    ON installments(status);

CREATE INDEX IF NOT EXISTS idx_installments_due_date
    ON installments(due_date);

CREATE INDEX IF NOT EXISTS idx_payments_installment_id
    ON payments(installment_id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_date
    ON payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_late_fees_status
    ON late_fees(status);
