// Called inside the initialization transaction with foreign keys temporarily off.
// Bridge pre-v5 ownership so the next migration can assign each loan safely.
export function migrateCompanies(db, schema) {
  const clientColumns = db.pragma('table_info(clients)').map(({name}) => name);
  const hasCompanyColumn = clientColumns.includes('company_id');
  db.exec(schema.match(/CREATE TABLE IF NOT EXISTS companies \([\s\S]*?\n\);/)[0]);
  db.prepare('INSERT OR IGNORE INTO companies(id,name) VALUES(1,?),(2,?)')
    .run('Dinheiro Express', 'Platinum Finance');
  if (db.pragma('table_info(users)').length) {
    db.exec(`DROP TRIGGER IF EXISTS users_role_insert;
      DROP TRIGGER IF EXISTS users_role_update;
      DROP TRIGGER IF EXISTS protect_last_master_update;
      DROP TRIGGER IF EXISTS protect_last_master_delete;
      DROP TRIGGER IF EXISTS protect_last_admin_update;
      DROP TRIGGER IF EXISTS protect_last_admin_delete;
      CREATE TEMP TABLE company_migration_roles AS SELECT id,role FROM users;
      ALTER TABLE users DROP COLUMN role;
      ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user'));
      UPDATE users SET role=(SELECT CASE WHEN role='master' THEN 'admin' ELSE role END
        FROM company_migration_roles WHERE id=users.id);
      DROP TABLE company_migration_roles;`);
    db.exec(schema.match(/CREATE TABLE IF NOT EXISTS user_companies \([\s\S]*?\n\);/)[0]);
    if (!hasCompanyColumn && !db.pragma('table_info(loans)').some(({name}) => name === 'company_id')) db.exec("INSERT INTO user_companies(user_id,company_id) SELECT id,1 FROM users WHERE role='user' AND access_status IN ('active','blocked')");
  }
  if (clientColumns.length && !hasCompanyColumn && !db.pragma('table_info(loans)').some(({name}) => name === 'company_id')) {
    db.exec('ALTER TABLE clients ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id)');
  }
}
