export const tables = ['users','companies','user_companies','user_access_companies','clients','loans','installments','payments','late_fees','auth_sessions','auth_audit_logs','auth_rate_limits'];
export async function checkSchema(db) {
  for (const table of tables) await db.prepare(`SELECT * FROM ${table} LIMIT 0`).all();
  if (db.dialect === 'sqlite') {
    const integrity = await db.pragma('integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' ||
      (await db.pragma('foreign_key_check')).length || (await db.pragma('foreign_keys', { simple:true })) !== 1)
      throw new Error('Schema SQLite inválido.');
    return { dialect:'sqlite', version:await db.pragma('user_version', { simple:true }), tables:tables.length };
  }
  const invalid = await db.prepare(`SELECT conname FROM pg_constraint
    WHERE connamespace=current_schema()::regnamespace AND NOT convalidated`).all();
  if (invalid.length) throw new Error('Há constraints PostgreSQL não validadas.');
  const { version } = await db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
  return { dialect:'postgres', version, tables:tables.length };
}
