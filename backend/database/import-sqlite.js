import { resolve } from 'node:path';
import { openDatabase, closeDatabase } from '../src/config/database.js';
import { importSqlite } from '../src/infrastructure/persistence/import-sqlite.js';
try {
  if (process.argv.length !== 3) throw new Error('Informe o caminho da cópia SQLite v5.');
  const result = await importSqlite(resolve(process.argv[2]), await openDatabase());
  process.stdout.write(`Importação concluída: ${JSON.stringify(result)}\n`);
} catch {
  process.stderr.write('Importação recusada ou revertida. Use uma cópia SQLite v5 válida e PostgreSQL recém-inicializado.\n');
  process.exitCode = 1;
} finally { await closeDatabase(); }
