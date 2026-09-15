import * as service from "./payments.service.js";
import {
  paymentSchema,
  confirmationSchema,
  paymentPreviewSchema,
} from "./payments.validator.js";
import { idSchema } from "../../shared/utils/validation.js";

export const create = async (req, res) =>
  res
    .status(201)
    .json(
      (await service.registerPayment(
        idSchema.parse(req.params.id),
        paymentSchema.parse(req.body),
        req.user,
      )),
    );
export const confirm = async (req, res) =>
  res.json(
    (await service.confirmPayments(
      idSchema.parse(req.params.id),
      confirmationSchema.parse(req.body),
      req.user,
    )),
  );
export const preview = async (req, res) =>
  res.json(
    (await service.previewPayment(
      idSchema.parse(req.params.id),
      paymentPreviewSchema.parse(req.body),
    )),
  );
