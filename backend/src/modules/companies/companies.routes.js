import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/auth.middleware.js';
import { atomic, recordAction } from '../auth/auth.repository.js';
import { createCompany, listCompanies, updateCompany } from './companies.repository.js';
import { idSchema } from '../../shared/utils/validation.js';
import * as controller from './companies.controller.js';
import { authorizeGlobalAdministrator } from './companies.service.js';

const schema = z.object({name:z.string().trim().min(2).max(150)}).strict();
export const companiesRoutes = Router();
companiesRoutes.get('/', async (_req,res) => res.json((await listCompanies())));
companiesRoutes.get('/managed',controller.managedCompanies);
companiesRoutes.get('/:id/users',controller.listUsers);
companiesRoutes.patch('/:id/users/:userId',controller.changeMember);
companiesRoutes.delete('/:id/users/:userId',controller.removeMember);
companiesRoutes.post('/', requireRole('admin'), async (req,res) => {
  const {name} = schema.parse(req.body);
  const company = (await atomic(async () => {
    await authorizeGlobalAdministrator(req.user);
    const result = (await createCompany(name));
    (await recordAction('company_created',req.user,'company',result.id,{name}));
    return result;
  }));
  res.status(201).json(company);
});
companiesRoutes.patch('/:id', requireRole('admin'), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const { name } = schema.parse(req.body);
  const company = await atomic(async () => {
    await authorizeGlobalAdministrator(req.user);
    const result = await updateCompany(id, name);
    await recordAction('company_updated', req.user, 'company', id, { name });
    return result;
  });
  res.json(company);
});
