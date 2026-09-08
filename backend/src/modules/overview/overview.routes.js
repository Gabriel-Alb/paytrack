import { Router } from "express";
import * as controller from "./overview.controller.js";

export const overviewRoutes = Router();
overviewRoutes.get("/dashboard/summary", controller.dashboard);
overviewRoutes.get("/reports", controller.report);
overviewRoutes.get("/notifications", controller.notifications);
