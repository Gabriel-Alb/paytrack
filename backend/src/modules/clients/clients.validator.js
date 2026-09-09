import { z } from "zod";
import { notes, listSchema } from "../../shared/utils/validation.js";

export const clientStatus = z.enum([
  "sem_contrato",
  "ativo",
  "quitado",
  "negativado",
]);
const document = z
  .string()
  .trim()
  .max(30)
  .regex(/^[\d.\-\s/]*$/)
  .transform((value) => value.replace(/\D/g, ""));
const optionalDocument = document
  .transform((value) => value || null)
  .nullable()
  .optional();

export function validCpf(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  for (let length = 9; length <= 10; length++) {
    let sum = 0;
    for (let index = 0; index < length; index++)
      sum += Number(value[index]) * (length + 1 - index);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(value[length])) return false;
  }
  return true;
}

export const clientSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    cpf: document.refine(validCpf, "CPF inválido."),
    rg: z
      .string()
      .trim()
      .max(30)
      .regex(/^[\da-zA-Z.\-\s/]*$/)
      .transform(
        (value) => value.replace(/[^\da-zA-Z]/g, "").toUpperCase() || null,
      )
      .nullable()
      .optional(),
    cnh: optionalDocument.refine(
      (value) => !value || /^\d{11}$/.test(value),
      "CNH deve conter 11 dígitos.",
    ),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[\d\s()+.-]*$/)
      .transform((value) => value.replace(/\D/g, "") || null)
      .nullable()
      .optional(),
    email: z
      .union([z.email().max(254), z.literal(""), z.null()])
      .optional()
      .transform((value) => value?.toLowerCase() || null),
    notes,
  })
  .strict();
export const clientPatchSchema = clientSchema
  .partial()
  .extend({ status: clientStatus.optional() })
  .strict();
export const clientListSchema = listSchema.extend({
  status: clientStatus.optional(),
});
