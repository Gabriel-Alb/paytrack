// Runs in the initialization transaction, before access guards, with FKs off.
export function migrateLoanCompanies(db, schema) {
  if (!db.pragma('table_info(clients)').some(column => column.name === 'company_id')) return;
  for (const table of ['loans', 'clients']) {
    const columns = db.pragma(`table_info(${table})`).map(column => column.name);
    if (!columns.length) continue;
    const sequence = db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(table)?.seq ?? 0;
    const definition = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))[0];
    db.exec(definition.replace(`${table} (`, `${table}_migrating (`));
    const target = columns.filter(column => column !== 'company_id');
    const source = target.map(column => `${table}.${column}`);
    if (table === 'loans') {
      target.push('company_id');
      source.push(columns.includes('company_id') ? 'loans.company_id' : '(SELECT company_id FROM clients WHERE id=loans.client_id)');
    }
    db.exec(`INSERT INTO ${table}_migrating (${target.join(',')}) SELECT ${source.join(',')} FROM ${table};
      DROP TABLE ${table}; ALTER TABLE ${table}_migrating RENAME TO ${table};`);
    db.prepare('UPDATE sqlite_sequence SET seq=max(seq,?) WHERE name=?').run(sequence, table);
  }
}
