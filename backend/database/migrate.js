import { openDatabase, closeDatabase } from '../src/config/database.js';
try {
  const db = await openDatabase();
  process.stdout.write(`Migrations ${db.dialect} aplicadas.\n`);
} catch {
  process.stderr.write('Falha nas migrations. Verifique configuração, permissões e schema.\n');
  process.exitCode = 1;
} finally { await closeDatabase(); }
