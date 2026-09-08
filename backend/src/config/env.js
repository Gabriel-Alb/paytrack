import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

export const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
dotenv.config({ path: resolve(backendRoot, ".env"), quiet: true });

const values = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default("127.0.0.1"),
    DATABASE_PATH: z.string().default("./database/paytrack.db"),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
    TIME_ZONE: z.string().default("America/Sao_Paulo"),
    ATTENTION_DAYS: z.coerce.number().int().min(1).max(30).default(2),
  })
  .parse(process.env);
new Intl.DateTimeFormat("en", { timeZone: values.TIME_ZONE }).format();

export const env = {
  ...values,
  DATABASE_PATH:
    values.DATABASE_PATH === ":memory:"
      ? ":memory:"
      : resolve(backendRoot, values.DATABASE_PATH),
};
