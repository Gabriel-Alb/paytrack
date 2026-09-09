import * as service from "./late-fees.service.js";
import { readFinancial } from '../installments/installments.service.js';
import { idSchema } from "../../shared/utils/validation.js";
import { paymentSchema } from "../payments/payments.validator.js";

export const get = (req, res) =>
  res.json(readFinancial(() => service.getFee(idSchema.parse(req.params.id))));
export const pay = (req, res) =>
  res
    .status(201)
    .json(
      service.payFee(
        idSchema.parse(req.params.id),
        paymentSchema.parse(req.body),
      ),
    );
