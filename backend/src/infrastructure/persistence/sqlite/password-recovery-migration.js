// Called inside the initialization transaction; schema.sql creates the request table.
export function migratePasswordRecovery(db) {
  const columns = db.pragma('table_info(users)').map(({name}) => name);
  if (!columns.length) return;
  if (!columns.includes('must_change_password'))
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1))');
  if (!columns.includes('temporary_password_expires_at'))
    db.exec('ALTER TABLE users ADD COLUMN temporary_password_expires_at INTEGER');
}
