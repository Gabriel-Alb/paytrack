import { Pool, types } from 'pg';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function number(value) {
  const result = Number(value);
  if (!Number.isFinite(result) || Math.abs(result) > Number.MAX_SAFE_INTEGER)
    throw new RangeError('Valor do banco excede a precisão da API.');
  return result;
}
// Per-pool parsers, without changing pg's global type registry.
export function postgresOptions(config) {
  if (config.schema && !/^[a-z_][a-z0-9_]*$/.test(config.schema)) throw new Error('Schema inválido.');
  return {
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    connectionTimeoutMillis: config.DATABASE_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS,
    statement_timeout: config.DATABASE_STATEMENT_TIMEOUT_MS,
    options: `-c timezone=UTC -c search_path=${config.schema ?? 'public'}`,
    ssl: config.DATABASE_SSL === 'disable' ? false : {
      rejectUnauthorized: true,
      ...(config.DATABASE_SSL_CA ? { ca: readFileSync(config.DATABASE_SSL_CA, 'utf8') } : {}),
    },
    types: { getTypeParser: (oid, format) => [20,1700].includes(oid) ? number : types.getTypeParser(oid, format) },
  };
}

export async function migratePostgres(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(728194000)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const latest = (await client.query('SELECT MAX(version) AS version FROM schema_migrations')).rows[0].version;
    if (latest > 2) throw new Error('Versão PostgreSQL mais recente que a aplicação.');
    for (const [version, file] of [[1, '001-initial.sql'], [2, '002-loan-companies.sql']]) {
      const sql = readFileSync(new URL(`./postgres/${file}`, import.meta.url), 'utf8').replaceAll('\r\n','\n');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = (await client.query('SELECT checksum FROM schema_migrations WHERE version=$1', [version])).rows[0];
      if (applied && applied.checksum !== checksum) throw new Error('Checksum da migration PostgreSQL divergente.');
      if (!applied) {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)', [version,checksum]);
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function openPostgres(config) {
  const pool = new Pool(postgresOptions(config));
  pool.on('error', () => console.error('Falha em conexão ociosa PostgreSQL.'));
  try { await migratePostgres(pool); return pool; }
  catch (error) { await pool.end(); throw error; }
}
