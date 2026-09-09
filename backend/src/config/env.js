import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

export const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
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
    DATABASE_PATH: z.string().default("./database/paytrack.db"),
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

export const env = {
  ...values,
  DATABASE_PATH:
    values.DATABASE_PATH === ":memory:"
      ? ":memory:"
      : resolve(backendRoot, values.DATABASE_PATH),
};
