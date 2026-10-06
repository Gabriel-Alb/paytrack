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
    fee_only: z.boolean().default(false),
    late_fee_received_amount: cents.default(0),
    payment_date: dateSchema,
    payment_method: z.string().trim().max(50).optional(),
    notes,
    revision: z.number().int().min(0),
  })
  .strict();
export const paymentPreviewSchema = z
  .object({ payment_date: dateSchema })
  .strict();
const legacyConfirmationSchema = z
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

export const confirmationSchema = z.union([
  legacyConfirmationSchema,
  z.object({
    revision: z.number().int().min(0),
    receipts: z.array(paymentSchema.omit({ revision: true }).extend({
      installment_number: z.number().int().min(1).max(120),
    })).max(120),
    void_payment_ids: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).max(1000).default([]),
    waive_installment_ids: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).max(120).default([]),
  }).strict().refine(({ void_payment_ids }) => new Set(void_payment_ids).size === void_payment_ids.length,
    'Pagamento repetido.').refine(({ waive_installment_ids }) => new Set(waive_installment_ids).size === waive_installment_ids.length,
    'Parcela repetida.'),
]);
