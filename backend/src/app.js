import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { loansRoutes } from "./modules/loans/loans.routes.js";
import { installmentsRoutes } from "./modules/installments/installments.routes.js";
import { lateFeesRoutes } from "./modules/late-fees/late-fees.routes.js";
import { overviewRoutes } from "./modules/overview/overview.routes.js";
import { errorHandler } from "./shared/middleware/errors.js";
import { AppError } from "./shared/errors/AppError.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json({ limit: "128kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/clients", clientsRoutes);
app.use("/api/loans", loansRoutes);
app.use("/api/installments", installmentsRoutes);
app.use("/api/late-fees", lateFeesRoutes);
app.use("/api", overviewRoutes);
app.use((_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Rota não encontrada.")),
);
app.use(errorHandler);
