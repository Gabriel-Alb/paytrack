import { spawn } from 'node:child_process';
if (!process.env.TEST_DATABASE_URL) throw new Error('Defina TEST_DATABASE_URL para um PostgreSQL exclusivo de testes.');
const child = spawn(process.execPath, ['--import','./tests/setup-env.js','--test','--test-concurrency=1',
  'tests/activity.test.js','tests/auth.test.js','tests/company-access.test.js','tests/company-roles.test.js','tests/financial.test.js','tests/persistence.test.js','tests/postgres.test.js'],
{ stdio:'inherit', env:process.env });
child.on('error', () => { process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
