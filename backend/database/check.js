import { openDatabase, closeDatabase } from '../src/config/database.js';
import { checkSchema } from '../src/infrastructure/persistence/check.js';
try { process.stdout.write(JSON.stringify(await checkSchema(await openDatabase())) + '\n'); }
catch { process.stderr.write('Falha na validação do schema.\n'); process.exitCode = 1; }
finally { await closeDatabase(); }
