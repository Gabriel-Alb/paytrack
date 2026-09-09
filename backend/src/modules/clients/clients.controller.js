import * as service from "./clients.service.js";
import { readFinancial } from '../installments/installments.service.js';
import {
  clientSchema,
  clientPatchSchema,
  clientListSchema,
} from "./clients.validator.js";
import { idSchema } from "../../shared/utils/validation.js";

export const list = (req, res) =>
  res.json(readFinancial(() => service.listClients(clientListSchema.parse(req.query))));
export const get = (req, res) =>
  res.json(readFinancial(() => service.getClient(idSchema.parse(req.params.id))));
export const create = (req, res) =>
  res.status(201).json(service.createClient(clientSchema.parse(req.body),req.user));
export const update = (req, res) =>
  res.json(
    service.updateClient(
      idSchema.parse(req.params.id),
      clientPatchSchema.parse(req.body),
      req.user,
    ),
  );
