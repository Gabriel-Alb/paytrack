import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

export const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
if (!['production', 'test'].includes(process.env.NODE_ENV))
  dotenv.config({ path: resolve(backendRoot, ".env"), quiet: true });

const values = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    TRUST_PROXY: z.enum(['loopback']).optional(),
    SESSION_MAX_AGE: z.coerce.number().int().min(300).max(86400).default(86400),
    SESSION_IDLE_AGE: z.coerce.number().int().min(60).max(14400).default(7200),
    AUTH_WINDOW_MS: z.coerce.number().int().min(60000).max(3600000).default(900000),
    AUTH_LOGIN_IP_LIMIT: z.coerce.number().int().min(5).max(100).default(30),
    AUTH_LOGIN_ACCOUNT_LIMIT: z.coerce.number().int().min(3).max(30).default(10),
    AUTH_REQUEST_IP_LIMIT: z.coerce.number().int().min(1).max(20).default(5),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default("127.0.0.1"),
    DATABASE_PATH: z.string().optional(),
    DATABASE_CLIENT: z.enum(['postgres', 'sqlite']).optional(),
    DATABASE_URL: z.string().optional(),
    DATABASE_SSL: z.enum(['verify-full', 'disable']).default('verify-full'),
    DATABASE_SSL_CA: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(10000),
    DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(30000),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(30000),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
    TIME_ZONE: z.string().default("America/Sao_Paulo"),
    ATTENTION_DAYS: z.coerce.number().int().min(1).max(30).default(2),
  })
  .parse(process.env);
new Intl.DateTimeFormat("en", { timeZone: values.TIME_ZONE }).format();
const origin = new URL(values.FRONTEND_ORIGIN);
if (origin.origin !== values.FRONTEND_ORIGIN || !['http:', 'https:'].includes(origin.protocol))
  throw new Error('FRONTEND_ORIGIN deve conter somente uma origem HTTP(S).');
if (values.NODE_ENV === 'production' && (!process.env.FRONTEND_ORIGIN || origin.protocol !== 'https:'))
  throw new Error('Produção exige FRONTEND_ORIGIN explícita com HTTPS.');

const databasePath = values.DATABASE_PATH ?? (values.NODE_ENV === 'test' ? ':memory:' : './database/paytrack.db');
export const env = {
  ...values,
  DATABASE_CLIENT: values.DATABASE_CLIENT ?? (values.NODE_ENV === 'production' ? 'postgres' : 'sqlite'),
  DATABASE_PATH:
    databasePath === ":memory:"
      ? ":memory:"
      : resolve(backendRoot, databasePath),
};
if (env.NODE_ENV === 'production' && env.DATABASE_CLIENT !== 'postgres')
  throw new Error('Produção exige PostgreSQL.');
if (env.DATABASE_CLIENT === 'postgres') {
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('PostgreSQL exige DATABASE_URL válida.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL deve usar PostgreSQL.');
  if (['sslmode','sslcert','sslkey','sslrootcert'].some(key => url.searchParams.has(key)))
    throw new Error('Configure TLS por DATABASE_SSL e DATABASE_SSL_CA, sem parâmetros SSL na URL.');
}
