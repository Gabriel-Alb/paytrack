import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { migrate } from "./sqlite/migrations.js";
import { migrateAuth, migrateRoles, migrateActionAudit } from './sqlite/auth-migration.js';
import { proportionalAmount } from "../../shared/utils/money.js";

import { migrateCompanies } from './sqlite/company-migration.js';
import { migrateLoanCompanies } from './sqlite/loan-company-migration.js';
import { installCompanyAccess } from './sqlite/company-access.js';
import { migrateCompanyRoles } from './sqlite/company-roles-migration.js';

const schema = readFileSync(
  new URL("../../../../SQL/schema.sql", import.meta.url),
  "utf8",
);

export function openSqlite(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.function("money_share", { deterministic: true }, proportionalAmount);
    db.function('greatest', { deterministic: true, varargs: true }, (...values) => Math.max(...values));
    db.function('day_number', { deterministic: true }, value => Math.floor(Date.parse(value + 'T00:00:00Z') / 86400000));
    db.function('utc_now', () => new Date().toISOString().slice(0,19).replace('T',' '));
    // Match SQLite's existing ASCII-only NOCASE/LIKE behavior on both engines.
    db.function('ascii_lower', { deterministic:true }, value => value?.replace(/[A-Z]/g, character => character.toLowerCase()) ?? null);
    db.pragma("foreign_keys = OFF");
    db.transaction(() => {
      const version = db.pragma('user_version', { simple: true });
      if (version > 7) throw new Error('Versão SQLite mais recente que a aplicação.');
      migrate(db, schema);
      migrateAuth(db);
      if (version < 3) migrateRoles(db);
      migrateActionAudit(db);
      if (version < 5) migrateCompanies(db, schema);
      if (version < 6) migrateLoanCompanies(db, schema);
      if (version < 7) migrateCompanyRoles(db);
      db.exec(schema);
      if (db.pragma("foreign_key_check").length)
        throw new Error("Banco contém referências inválidas.");
      db.pragma("user_version = 7");
    }).immediate();
    db.pragma("foreign_keys = ON");
    installCompanyAccess(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
