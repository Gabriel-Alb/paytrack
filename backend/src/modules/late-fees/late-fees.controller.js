import * as service from "./late-fees.service.js";
import { readFinancial } from '../installments/installments.service.js';
import { idSchema } from "../../shared/utils/validation.js";
import { paymentSchema } from "../payments/payments.validator.js";

export const get = async (req, res) =>
  res.json((await readFinancial(async () => (await service.getFee(idSchema.parse(req.params.id))))));
export const pay = async (req, res) =>
  res
    .status(201)
    .json(
      (await service.payFee(
        idSchema.parse(req.params.id),
        paymentSchema.parse(req.body),
        req.user,
      )),
    );
