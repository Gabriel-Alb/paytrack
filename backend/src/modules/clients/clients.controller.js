import * as service from "./clients.service.js";
import { readFinancial } from '../installments/installments.service.js';
import {
  clientSchema,
  clientPatchSchema,
  clientListSchema,
} from "./clients.validator.js";
import { idSchema } from "../../shared/utils/validation.js";

export const list = async (req, res) =>
  res.json((await readFinancial(async () => (await service.listClients(clientListSchema.parse(req.query))))));
export const get = async (req, res) =>
  res.json((await readFinancial(async () => (await service.getClient(idSchema.parse(req.params.id))))));
export const create = async (req, res) =>
  res.status(201).json((await service.createClient(clientSchema.parse(req.body),req.user)));
export const update = async (req, res) =>
  res.json(
    (await service.updateClient(
      idSchema.parse(req.params.id),
      clientPatchSchema.parse(req.body),
      req.user,
    )),
  );
