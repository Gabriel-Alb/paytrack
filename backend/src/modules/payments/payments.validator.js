import { z } from "zod";
import {
  cents,
  positiveCents,
  dateSchema,
  notes,
} from "../../shared/utils/validation.js";

export const paymentSchema = z
  .object({
    amount: positiveCents,
    payment_date: dateSchema,
    payment_method: z.string().trim().max(50).optional(),
    notes,
    revision: z.number().int().min(0),
  })
  .strict();
export const paymentPreviewSchema = z
  .object({ payment_date: dateSchema })
  .strict();
export const confirmationSchema = z
  .object({
    revision: z.number().int().min(0),
    payments: z
      .array(
        z
          .object({
            installment_number: z.number().int().min(1).max(120),
            payment_date: dateSchema,
            late_fee_received_amount: cents,
          })
          .strict(),
      )
      .max(120),
  })
  .strict()
  .refine(
    ({ payments }) =>
      new Set(payments.map((item) => item.installment_number)).size ===
      payments.length,
    "Parcela repetida.",
  );
