import { AsyncLocalStorage } from 'node:async_hooks';
import { bindParameters } from './parameters.js';
import { persistenceError } from './errors.js';
import { companyAccessContext } from '../../application/company-access.js';

// A client belongs to an async operation, never to a mutable global request.
export function createAdapter(driver, dialect) {
  const context = new AsyncLocalStorage();
  let queue = Promise.resolve();
  let sequence = 0;
  const raw = async (client, sql, values = []) => dialect === 'postgres'
    ? client.query(sql, values) : client.exec(sql);

  async function transaction(operation, { rollback = false, serialize = true } = {}) {
    const parent = context.getStore();
    if (parent) {
      if (!parent.active) throw new Error('Transação encerrada.');
      const savepoint = `nested_${++sequence}`;
      await raw(parent.client, `SAVEPOINT ${savepoint}`);
      try {
        const result = await operation();
        if (rollback) await raw(parent.client, `ROLLBACK TO SAVEPOINT ${savepoint}`);
        await raw(parent.client, `RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        await raw(parent.client, `ROLLBACK TO SAVEPOINT ${savepoint}`);
        await raw(parent.client, `RELEASE SAVEPOINT ${savepoint}`);
        throw persistenceError(error);
      }
    }
    let unlock;
    if (dialect === 'sqlite') {
      const previous = queue;
      queue = new Promise(resolve => { unlock = resolve; });
      await previous;
    }
    let client, state, releaseError;
    try {
      client = dialect === 'postgres' ? await driver.connect() : driver;
      await raw(client, dialect === 'sqlite' ? 'BEGIN IMMEDIATE' : 'BEGIN');
      if (dialect === 'postgres') {
        // Existing reconciliation updates the entire accessible portfolio. Preserve
        // its serial semantics across workers before any business reads occur.
        if (serialize) await raw(client, 'SELECT pg_advisory_xact_lock(728194001)');
        const access = companyAccessContext();
        await raw(client, "SELECT set_config('paytrack.access', $1, true)", [JSON.stringify(access ?? { role: 'admin', companyIds: [] })]);
      }
      state = { client, active: true };
      const result = await context.run(state, operation);
      await raw(client, rollback ? 'ROLLBACK' : 'COMMIT');
      return result;
    } catch (error) {
      if (client) await raw(client, 'ROLLBACK').catch(error => { releaseError = error; });
      throw persistenceError(error);
    } finally {
      if (state) state.active = false;
      if (dialect === 'postgres') client?.release(releaseError);
      unlock?.();
    }
  }
  async function query(sql, args, mode) {
    const execute = async () => {
      const state = context.getStore();
      if (!state.active) throw new Error('Transação encerrada.');
      const { text, values } = bindParameters(sql, args, dialect);
      try {
        if (dialect === 'sqlite') return state.client.prepare(text)[mode](...values);
        const insert = mode === 'run' && /^\s*INSERT\s+INTO\s+(users|companies|clients|loans|installments|payments|late_fees|auth_sessions|auth_audit_logs)\b/i.test(text) && !/\bRETURNING\b/i.test(text);
        const result = await state.client.query(insert ? text + ' RETURNING id' : text, values);
        if (mode === 'get') return result.rows[0];
        if (mode === 'all') return result.rows;
        return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
      } catch (error) { throw persistenceError(error); }
    };
    return context.getStore() ? execute() : transaction(execute, { serialize: false });
  }
  return {
    dialect,
    transaction,
    prepare(sql) {
      return Object.fromEntries(['get','all','run'].map(mode => [mode, (...args) => query(sql, args, mode)]));
    },
    async exec(sql) {
      const execute = () => raw(context.getStore().client, sql);
      return context.getStore() ? execute() : transaction(execute);
    },
    // SQLite diagnostics are infrastructure-only (legacy migration tests / CLI).
    async pragma(sql, options) {
      if (dialect !== 'sqlite') throw new Error('Diagnóstico exclusivo do SQLite.');
      return driver.pragma(sql, options);
    },
    async close() { await queue; if (dialect === 'postgres') await driver.end(); else driver.close(); },
  };
}
