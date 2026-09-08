import { z } from "zod";
import { dateSchema, listSchema } from "../../shared/utils/validation.js";

export const reportSchema = listSchema
  .extend({
    start: dateSchema,
    end: dateSchema,
    mode: z.enum(["day", "week", "month"]).default("day"),
    status: z.enum(["all", "paid", "partial", "unpaid"]).default("all"),
    sort: z
      .enum([
        "client",
        "contractId",
        "date",
        "expected",
        "received",
        "pending",
        "paymentDate",
        "status",
      ])
      .default("date"),
    direction: z.enum(["asc", "desc"]).default("asc"),
  })
  .refine(
    (data) =>
      data.end >= data.start &&
      (Date.parse(data.end) - Date.parse(data.start)) / 86400000 <= 366,
    "Informe um período válido de até 367 dias.",
  );
