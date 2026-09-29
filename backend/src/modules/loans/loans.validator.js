import { z } from "zod";
import {
  cents,
  positiveCents,
  dateSchema,
  idSchema,
  notes,
  listSchema,
} from "../../shared/utils/validation.js";

const percentage = z
  .union([z.string(), z.number()])
  .transform(String)
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,3}(\.\d{1,2})?$/,
        "Juros devem ter no máximo duas casas decimais.",
      ),
  );
const loanFields = z
  .object({
    company_id: idSchema.optional(),
    client_id: idSchema,
    principal_amount: positiveCents,
    interest_percentage: percentage.default("0"),
    installment_count: z.number().int().min(1).max(120),
    late_fee_per_day: cents.default(0),
    loan_date: dateSchema,
    first_due_date: dateSchema,
    installments: z.array(positiveCents).min(1).max(120).optional(),
    installment_overrides: z
      .record(z.string().regex(/^\d+$/), positiveCents)
      .optional(),
    notes,
  })
  .strict();
export const loanSchema = loanFields.refine((data) => data.first_due_date >= data.loan_date, {
  message: "O primeiro vencimento não pode ser anterior ao empréstimo.",
  path: ["first_due_date"],
});
export const loanPatchSchema = z
  .object({
    ...loanFields.partial().shape,
    interest_percentage: percentage.optional(),
    late_fee_per_day: cents.optional(),
    status: z.literal("cancelled").optional(),
    revision: z.number().int().min(0),
  })
  .strict();
export const loanListSchema = listSchema.extend({
  company_id: idSchema.optional(),
  client_id: idSchema.optional(),
  status: z
    .enum(["on-time", "attention", "overdue", "paid", "cancelled", "active"])
    .optional(),
});
export const amountsSchema = z
  .object({
    revision: z.number().int().min(0),
    installments: z.array(positiveCents).min(1).max(120),
  })
  .strict();
