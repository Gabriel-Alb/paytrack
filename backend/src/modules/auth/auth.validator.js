import { z } from 'zod';
import { clientSchema } from '../clients/clients.validator.js';
import { validPassword, PASSWORD_MESSAGE } from '../../../../shared/password.js';

export const emailSchema = z.string().trim().max(254).toLowerCase().pipe(z.email());
export const passwordSchema = z.string().refine(validPassword, PASSWORD_MESSAGE);
export const requestSchema = clientSchema.pick({ name: true, cpf: true, rg: true, cnh: true })
  .extend({ email: emailSchema, password: passwordSchema }).strict();
export const loginSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
export const changePasswordSchema = z.object({ currentPassword: passwordSchema, newPassword: passwordSchema }).strict();
export const accessSchema = z.object({ action: z.enum(['approve','reject','block','unblock']) }).strict();
export const usersQuerySchema = z.object({
  status: z.enum(['pending','active','rejected','blocked']).default('pending'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
