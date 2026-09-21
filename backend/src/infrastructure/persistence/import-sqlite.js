import { tables } from './check.js';

// Explicit, offline transfer. The source is always read-only; no SQLite file is
// upgraded or overwritten. Only a freshly initialized PostgreSQL is accepted.
export async function importSqlite(sourcePath, target) {
  if (target.dialect !== 'postgres') throw new Error('O destino deve ser PostgreSQL.');
  const { default: Database } = await import('better-sqlite3');
  const source = new Database(sourcePath, { readonly:true, fileMustExist:true });
  try {
    source.exec('BEGIN');
    if (![6,7].includes(source.pragma('user_version', { simple:true })) || source.pragma('foreign_key_check').length ||
      source.pragma('integrity_check')[0].integrity_check !== 'ok')
      throw new Error('A origem precisa estar no schema SQLite v6 ou v7, com referências válidas.');
    return await target.transaction(async () => {
      await target.exec(`LOCK TABLE ${tables.join(',')} IN ACCESS EXCLUSIVE MODE`);
      for (const table of tables.filter(table => table !== 'companies')) {
        if (await target.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()) throw new Error('O PostgreSQL de destino não está vazio.');
      }
      const companies = await target.prepare('SELECT id,name FROM companies ORDER BY id').all();
      if (JSON.stringify(companies) !== JSON.stringify([{id:1,name:'Dinheiro Express'},{id:2,name:'Platinum Finance'}]))
        throw new Error('O destino contém empresas que não pertencem ao bootstrap.');
      await target.exec('DELETE FROM companies');
      // Legacy duplicates were intentionally preserved by v6. The empty target is
      // exclusively locked; suspend only document guards during this exact copy.
      for (const key of ['cpf','rg','cnh']) await target.exec(`ALTER TABLE clients DISABLE TRIGGER clients_${key}_unique`);
      const counts = {};
      for (const table of tables) {
        if (table==='user_access_companies' && source.pragma('user_version', {simple:true})===6) { counts[table]=0; continue; }
        const rows = source.prepare(`SELECT * FROM ${table}`).safeIntegers(true).all().map(row =>
          Object.fromEntries(Object.entries(row).map(([key,value]) => {
            if (typeof value !== 'bigint') return [key,value];
            if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER))
              throw new Error('Inteiro da origem excede a precisão da API.');
            return [key,Number(value)];
          })));
        for (const original of rows) {
          const row = table === 'users' ? { ...original, approved_by:null } : original;
          const columns = Object.keys(row);
          // Column names come from the known source schema, never CLI/user input.
          if (columns.some(column => !/^[a-z_]+$/.test(column))) throw new Error('Coluna de origem inválida.');
          await target.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map(column => row[column]));
        }
        counts[table] = rows.length;
      }
      for (const user of source.prepare('SELECT id,approved_by FROM users WHERE approved_by IS NOT NULL').all())
        await target.prepare('UPDATE users SET approved_by=? WHERE id=?').run(user.approved_by,user.id);
      for (const table of tables.filter(table => !['user_companies','user_access_companies','auth_rate_limits'].includes(table))) {
        const { maximum } = await target.prepare(`SELECT COALESCE(MAX(id),0) AS maximum FROM ${table}`).get();
        const sequence = source.prepare('SELECT seq FROM sqlite_sequence WHERE name=?').get(table)?.seq ?? 0;
        const value = Math.max(maximum,sequence);
        await target.prepare("SELECT setval(pg_get_serial_sequence(?, 'id'), ?, ?)").get(table,Math.max(1,value),value > 0);
      }
      for (const key of ['cpf','rg','cnh']) await target.exec(`ALTER TABLE clients ENABLE TRIGGER clients_${key}_unique`);
      return counts;
    });
  } finally { source.close(); }
}
