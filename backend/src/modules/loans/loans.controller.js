import * as service from "./loans.service.js";
import { readFinancial } from '../installments/installments.service.js';
import {
  loanSchema,
  loanListSchema,
  loanPatchSchema,
  amountsSchema,
} from "./loans.validator.js";
import { idSchema } from "../../shared/utils/validation.js";

export const list = async (req, res) =>
  res.json((await readFinancial(async () => (await service.listLoans(loanListSchema.parse(req.query))))));
export const get = async (req, res) =>
  res.json((await readFinancial(async () => (await service.getLoan(idSchema.parse(req.params.id))))));
export const create = async (req, res) =>
  res.status(201).json((await service.createLoan(loanSchema.parse(req.body),req.user)));
export const update = async (req, res) =>
  res.json(
    (await service.updateLoan(
      idSchema.parse(req.params.id),
      loanPatchSchema.parse(req.body),
      req.user,
    )),
  );
export const installments = async (req, res) =>
  res.json((await readFinancial(async () => (await service.getLoan(idSchema.parse(req.params.id))).installments)));
export const updateInstallments = async (req, res) =>
  res.json(
    (await service.updateInstallments(
      idSchema.parse(req.params.id),
      amountsSchema.parse(req.body),
      req.user,
    )),
  );
