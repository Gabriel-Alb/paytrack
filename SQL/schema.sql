PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    cpf TEXT UNIQUE,
    rg TEXT UNIQUE,
    cnh TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
