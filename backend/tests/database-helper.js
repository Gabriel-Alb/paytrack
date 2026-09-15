import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { openDatabase as open, closeDatabase as close, database } from '../src/config/database.js';
export { database } from '../src/config/database.js';

let admin, schema;
export async function openDatabase(path = ':memory:') {
  if (!process.env.TEST_DATABASE_URL) return open(path);
  schema = 'paytrack_test_' + randomUUID().replaceAll('-', '');
  admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    return await open({ DATABASE_CLIENT: 'postgres', DATABASE_URL: process.env.TEST_DATABASE_URL, DATABASE_SSL: 'disable', schema });
  } catch (error) { await closeDatabase(); throw error; }
}
export async function closeDatabase() {
  await close();
  if (admin) {
    try { await admin.query(`DROP SCHEMA ${schema} CASCADE`); }
    finally { await admin.end(); admin = undefined; schema = undefined; }
  }
}
const failures = new Map();
export async function injectFailure({ name, event, table, condition }) {
  failures.set(name, table);
  if (database().dialect === 'sqlite')
    return database().exec(`CREATE TRIGGER ${name} BEFORE ${event} ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT,'injected failure'); END`);
  await database().exec(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF ${condition} THEN RAISE EXCEPTION 'injected failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER ${name} BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}()`);
}
export async function removeFailure(name) {
  return database().exec(database().dialect === 'sqlite' ? `DROP TRIGGER ${name}`
    : `DROP TRIGGER ${name} ON ${failures.get(name)}; DROP FUNCTION ${name}()`);
}
