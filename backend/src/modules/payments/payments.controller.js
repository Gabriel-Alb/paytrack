import * as service from "./payments.service.js";
import {
  paymentSchema,
  confirmationSchema,
  paymentPreviewSchema,
} from "./payments.validator.js";
import { idSchema } from "../../shared/utils/validation.js";

export const create = (req, res) =>
  res
    .status(201)
    .json(
      service.registerPayment(
        idSchema.parse(req.params.id),
        paymentSchema.parse(req.body),
        req.user,
      ),
    );
export const confirm = (req, res) =>
  res.json(
    service.confirmPayments(
      idSchema.parse(req.params.id),
      confirmationSchema.parse(req.body),
      req.user,
    ),
  );
export const preview = (req, res) =>
  res.json(
    service.previewPayment(
      idSchema.parse(req.params.id),
      paymentPreviewSchema.parse(req.body),
    ),
  );
