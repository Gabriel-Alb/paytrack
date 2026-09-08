import { Router } from "express";
import { create, preview } from "../payments/payments.controller.js";

export const installmentsRoutes = Router();
installmentsRoutes.post("/:id/payments", create);
installmentsRoutes.post("/:id/payment-preview", preview);
