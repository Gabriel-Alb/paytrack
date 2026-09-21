// Initialization owns the transaction: any failure rolls back DDL, data and version.
export function migrateCompanyRoles(db) {
  const columns = db.pragma('table_info(user_companies)');
  if (columns.length && !columns.some(column => column.name === 'role'))
    db.exec("ALTER TABLE user_companies ADD COLUMN role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','MANAGER'))");
}
