import * as service from './companies.service.js';
import { idSchema } from '../../shared/utils/validation.js';
import { membersQuerySchema } from './companies.validator.js';
export const managedCompanies = async (req,res) => res.json(await service.managedCompanies(req.user));
export const listUsers = async (req,res) => res.json(await service.listCompanyUsers(req.user,idSchema.parse(req.params.id),membersQuerySchema.parse(req.query).page));
export const changeMember = async (req,res) => res.json(await service.changeMembership(req.user,idSchema.parse(req.params.id),idSchema.parse(req.params.userId),req.body));
export const removeMember = async (req,res) => {
  await service.removeCompanyUser(req.user,idSchema.parse(req.params.id),idSchema.parse(req.params.userId));
  res.status(204).end();
};
