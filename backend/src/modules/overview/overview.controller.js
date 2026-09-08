import * as service from "./overview.service.js";
import { reportSchema } from "./overview.validator.js";

export const dashboard = (_req, res) => res.json(service.dashboard());
export const report = (req, res) =>
  res.json(service.report(reportSchema.parse(req.query)));
export const notifications = (_req, res) => res.json(service.notifications());
