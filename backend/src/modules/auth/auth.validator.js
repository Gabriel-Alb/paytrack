import { z } from 'zod';
import { clientSchema } from '../clients/clients.validator.js';
import { validPassword, PASSWORD_MESSAGE } from '../../../../shared/password.js';

export const emailSchema = z.string().trim().max(254).toLowerCase().pipe(z.email());
export const passwordSchema = z.string().refine(validPassword, PASSWORD_MESSAGE);
export const requestSchema = clientSchema.pick({ name: true, cpf: true, rg: true, cnh: true })
  .extend({ email: emailSchema, password: passwordSchema,
    companyIds:z.array(z.number().int().positive()).min(1).max(10000)
      .refine(ids => new Set(ids).size===ids.length,'Empresas duplicadas.').optional() }).strict();
export const loginSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const changePasswordSchema = z.object({ currentPassword: passwordSchema, newPassword: passwordSchema }).strict();
export const profileSchema = z.object({ email: emailSchema }).strict();
export const accessSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['approve','edit']), role: z.enum(['user','admin']).default('user'), companyIds: z.array(z.number().int().positive()).max(10000).default([]) }).strict()
    .refine(data => data.role === 'admin' || data.companyIds.length > 0, {message:'Selecione pelo menos uma empresa.',path:['companyIds']})
    .refine(data => new Set(data.companyIds).size === data.companyIds.length, {message:'Empresas duplicadas.',path:['companyIds']}),
  z.object({ action: z.enum(['reject','block','unblock']) }).strict(),
]);
export const usersQuerySchema = z.object({
  status: z.enum(['pending','active','rejected','blocked']).default('pending'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
