// Runs inside openDatabase's IMMEDIATE transaction. Conflicts roll back all changes.
export function migrateAuth(db) {
  const columns = db.pragma('table_info(users)').map(({ name }) => name);
  if (!columns.length || columns.includes('access_status')) return;
  const rows = db.prepare('SELECT id,email,cpf,rg,cnh FROM users').all();
  const seen = { email: new Set(), cpf: new Set(), rg: new Set(), cnh: new Set() };
  const normalized = rows.map((row) => {
    const data = {
      id: row.id, email: row.email.trim().toLowerCase(),
      cpf: row.cpf?.replace(/\D/g, '') || null,
      rg: row.rg?.replace(/[^a-zA-Z\d]/g, '').toUpperCase() || null,
      cnh: row.cnh?.replace(/\D/g, '') || null,
    };
    for (const field of Object.keys(seen)) {
      if (!data[field]) continue;
      if (seen[field].has(data[field])) throw new Error('Migração de autenticação: duplicidade após normalização; revisar dados offline.');
      seen[field].add(data[field]);
    }
    return data;
  });
  for (const row of normalized)
    db.prepare('UPDATE users SET email=@email,cpf=@cpf,rg=@rg,cnh=@cnh WHERE id=@id').run(row);
  db.exec(`ALTER TABLE users ADD COLUMN access_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(access_status IN ('pending','active','rejected','blocked'));
    ALTER TABLE users ADD COLUMN approved_by INTEGER REFERENCES users(id);
    ALTER TABLE users ADD COLUMN approved_at TEXT;
    ALTER TABLE users ADD COLUMN rejected_at TEXT;
    ALTER TABLE users ADD COLUMN blocked_at TEXT;
    ALTER TABLE users ADD COLUMN password_changed_at TEXT;
    ALTER TABLE users ADD COLUMN last_login_at TEXT;
    UPDATE users SET access_status = CASE
      WHEN active=0 THEN 'blocked'
      WHEN role='master' AND password_hash LIKE '$argon2id$%' THEN 'active'
      ELSE 'pending' END;
    ALTER TABLE users DROP COLUMN active;`);
  if (db.prepare("SELECT 1 FROM users WHERE role NOT IN ('master','user')").get())
    throw new Error('Migração de autenticação: role legado inválido; revisar offline.');
}
