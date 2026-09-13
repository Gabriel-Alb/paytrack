import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/auth.middleware.js';
import { atomic, recordAction } from '../auth/auth.repository.js';
import { createCompany, listCompanies } from './companies.repository.js';

const schema = z.object({name:z.string().trim().min(2).max(150)}).strict();
export const companiesRoutes = Router();
companiesRoutes.get('/', (_req,res) => res.json(listCompanies()));
companiesRoutes.post('/', requireRole('admin'), (req,res) => {
  const {name} = schema.parse(req.body);
  const company = atomic(() => {
    const result = createCompany(name);
    recordAction('company_created',req.user,'company',result.id,{name});
    return result;
  });
  res.status(201).json(company);
});
