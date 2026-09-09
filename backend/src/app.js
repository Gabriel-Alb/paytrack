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
import { authRoutes,usersRoutes } from './modules/auth/auth.routes.js';
import { loadSession,requireAuth,requireCsrf,trustedOrigin } from './modules/auth/auth.middleware.js';

export const app = express();
app.disable("x-powered-by");
if (env.TRUST_PROXY) app.set('trust proxy',env.TRUST_PROXY);
app.use(helmet({strictTransportSecurity:env.NODE_ENV==='production' ? {maxAge:31536000} : false}));
app.use((req,res,next) => {
  res.set('Cache-Control','no-store');
  if (env.NODE_ENV==='production' && !req.secure)
    return next(new AppError(400,'HTTPS_REQUIRED','HTTPS obrigatório.'));
  next();
});
app.use(cors({ origin: env.FRONTEND_ORIGIN,credentials:true,methods:['GET','POST','PUT','PATCH','DELETE'],allowedHeaders:['Content-Type','X-CSRF-Token'] }));
app.use(express.json({ limit: "128kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use('/api',loadSession);
app.use('/api/auth',authRoutes);
app.use('/api',requireAuth,trustedOrigin,requireCsrf);
app.use('/api/users',usersRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/loans", loansRoutes);
app.use("/api/installments", installmentsRoutes);
app.use("/api/late-fees", lateFeesRoutes);
app.use("/api", overviewRoutes);
app.use((_req, _res, next) =>
  next(new AppError(404, "NOT_FOUND", "Rota não encontrada.")),
);
app.use(errorHandler);
