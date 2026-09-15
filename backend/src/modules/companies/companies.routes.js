import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/auth.middleware.js';
import { atomic, recordAction } from '../auth/auth.repository.js';
import { createCompany, listCompanies } from './companies.repository.js';

const schema = z.object({name:z.string().trim().min(2).max(150)}).strict();
export const companiesRoutes = Router();
companiesRoutes.get('/', async (_req,res) => res.json((await listCompanies())));
companiesRoutes.post('/', requireRole('admin'), async (req,res) => {
  const {name} = schema.parse(req.body);
  const company = (await atomic(async () => {
    const result = (await createCompany(name));
    (await recordAction('company_created',req.user,'company',result.id,{name}));
    return result;
  }));
  res.status(201).json(company);
});
