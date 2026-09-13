import * as service from "./overview.service.js";
import { reportSchema } from "./overview.validator.js";
import { pendingNotifications } from '../auth/auth.service.js';
import { readFinancial } from '../installments/installments.service.js';

export const dashboard = (_req, res) => res.json(readFinancial(() => service.dashboard()));
export const report = (req, res) =>
  res.json(readFinancial(() => service.report(reportSchema.parse(req.query))));
export const notifications = (req, res) => res.json([
  ...(['admin'].includes(req.user.role) ? pendingNotifications() : []),
  ...readFinancial(() => service.notifications(['admin'].includes(req.user.role))),
]);
