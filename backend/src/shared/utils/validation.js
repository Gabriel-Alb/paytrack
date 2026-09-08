import { z } from "zod";

export const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const cents = z.number().int().min(0).max(100000000000);
export const positiveCents = cents.refine(
  (value) => value > 0,
  "Informe um valor positivo em centavos.",
);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return (
      Number.isFinite(timestamp) &&
      new Date(timestamp).toISOString().slice(0, 10) === value &&
      value >= "1900-01-01" &&
      value <= "2100-12-31"
    );
  }, "Data inválida.");
export const notes = z.string().trim().max(5000).nullable().optional();
export const listSchema = z.object({
  search: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function pagination(query) {
  return { ...query, offset: (query.page - 1) * query.limit };
}
