import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "./env.js";
import { migrate } from "./migrations.js";
import { proportionalAmount } from "../shared/utils/money.js";

let connection;
const schema = readFileSync(
  new URL("../../../SQL/schema.sql", import.meta.url),
  "utf8",
);

export function openDatabase(path = env.DATABASE_PATH) {
  if (connection) throw new Error("A conexão SQLite já está aberta.");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.function("money_share", { deterministic: true }, proportionalAmount);
    migrate(db, schema);
    db.exec(schema);
    if (db.pragma("foreign_key_check").length)
      throw new Error("Banco contém referências inválidas.");
    connection = db;
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function database() {
  if (!connection) throw new Error("SQLite não inicializado.");
  return connection;
}

export function closeDatabase() {
  connection?.close();
  connection = undefined;
}
