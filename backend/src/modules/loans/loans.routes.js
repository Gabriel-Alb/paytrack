import { Router } from "express";
import * as controller from "./loans.controller.js";
import { confirm } from "../payments/payments.controller.js";

export const loansRoutes = Router();
loansRoutes.get("/", controller.list);
loansRoutes.get("/:id", controller.get);
loansRoutes.post("/", controller.create);
loansRoutes.patch("/:id", controller.update);
loansRoutes.get("/:id/installments", controller.installments);
loansRoutes.patch("/:id/installments", controller.updateInstallments);
loansRoutes.put("/:id/payment-confirmation", confirm);
