import { env } from './env.js';
import { configurePersistence } from '../application/persistence.js';
import { createAdapter } from '../infrastructure/persistence/adapter.js';
import { database, setConnection } from '../infrastructure/persistence/connection.js';
export { database } from '../infrastructure/persistence/connection.js';

let opened = false;
export async function openDatabase(pathOrConfig) {
  if (opened) throw new Error('A persistência já está aberta.');
  const config = { ...env, ...(typeof pathOrConfig === 'object' ? pathOrConfig : {}) };
  if (!['postgres','sqlite'].includes(config.DATABASE_CLIENT)) throw new Error('Driver de persistência inválido.');
  if (env.NODE_ENV === 'production' && config.DATABASE_CLIENT !== 'postgres')
    throw new Error('Produção exige PostgreSQL.');
  if (typeof pathOrConfig === 'string') {
    if (config.DATABASE_CLIENT !== 'sqlite') throw new Error('DATABASE_PATH é exclusivo do SQLite.');
    config.DATABASE_PATH = pathOrConfig;
  }
  opened = true;
  let adapter;
  try {
    const driver = config.DATABASE_CLIENT === 'postgres'
      ? await (await import('../infrastructure/persistence/postgres.js')).openPostgres(config)
      : (await import('../infrastructure/persistence/sqlite.js')).openSqlite(config.DATABASE_PATH);
    adapter = createAdapter(driver, config.DATABASE_CLIENT);
    setConnection(adapter);
    const repositories = {};
    for (const name of ['auth','clients','companies','installments','late-fees','loans','overview','payments','rate-limits','password-recovery'])
      repositories[name] = await import(`../infrastructure/persistence/repositories/${name}.repository.js`);
    configurePersistence({ ...repositories, unitOfWork: adapter.transaction });
    return adapter;
  } catch (error) {
    await adapter?.close();
    opened = false;
    setConnection(undefined);
    throw error;
  }
}
export async function closeDatabase() {
  if (!opened) return;
  try { await database().close(); }
  finally { opened = false; setConnection(undefined); configurePersistence(undefined); }
}
