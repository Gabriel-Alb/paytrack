import { z } from 'zod';
import { clientSchema } from '../clients/clients.validator.js';

export const emailSchema = z.string().trim().max(254).toLowerCase().pipe(z.email());
// Count Unicode code points, never truncate or impose composition rules.
export const passwordSchema = z.string().max(1024).refine(
  (value) => [...value].length >= 15 && [...value].length <= 128,
  'A senha deve ter entre 15 e 128 caracteres.',
);
export const requestSchema = clientSchema.pick({ name: true, cpf: true, rg: true, cnh: true })
  .extend({ email: emailSchema, password: passwordSchema }).strict();
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(1024) }).strict();
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: passwordSchema }).strict();
export const accessSchema = z.object({ action: z.enum(['approve','reject','block','unblock']) }).strict();
export const usersQuerySchema = z.object({
  status: z.enum(['pending','active','rejected','blocked']).default('pending'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
