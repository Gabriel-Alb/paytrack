import { Router } from "express";
import * as controller from "./late-fees.controller.js";

export const lateFeesRoutes = Router();
lateFeesRoutes.get("/:id", controller.get);
lateFeesRoutes.post("/:id/payments", controller.pay);
