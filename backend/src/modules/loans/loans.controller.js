import * as service from "./loans.service.js";
import { readFinancial } from '../installments/installments.service.js';
import {
  loanSchema,
  loanListSchema,
  loanPatchSchema,
  amountsSchema,
} from "./loans.validator.js";
import { idSchema } from "../../shared/utils/validation.js";

export const list = (req, res) =>
  res.json(readFinancial(() => service.listLoans(loanListSchema.parse(req.query))));
export const get = (req, res) =>
  res.json(readFinancial(() => service.getLoan(idSchema.parse(req.params.id))));
export const create = (req, res) =>
  res.status(201).json(service.createLoan(loanSchema.parse(req.body)));
export const update = (req, res) =>
  res.json(
    service.updateLoan(
      idSchema.parse(req.params.id),
      loanPatchSchema.parse(req.body),
    ),
  );
export const installments = (req, res) =>
  res.json(readFinancial(() => service.getLoan(idSchema.parse(req.params.id)).installments));
export const updateInstallments = (req, res) =>
  res.json(
    service.updateInstallments(
      idSchema.parse(req.params.id),
      amountsSchema.parse(req.body),
    ),
  );
