import * as service from "./overview.service.js";
import { reportSchema } from "./overview.validator.js";
import { pendingNotifications } from '../auth/auth.service.js';
import { readFinancial } from '../installments/installments.service.js';

export const dashboard = async (_req, res) => res.json((await readFinancial(async () => (await service.dashboard()))));
export const report = async (req, res) =>
  res.json((await readFinancial(async () => (await service.report(reportSchema.parse(req.query))))));
export const notifications = async (req, res) => res.json([
  ...(['admin'].includes(req.user.role) ? (await pendingNotifications()) : []),
  ...(await readFinancial(async () => (await service.notifications(['admin'].includes(req.user.role))))),
]);
