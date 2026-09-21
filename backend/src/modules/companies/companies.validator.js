import { z } from 'zod';
export const companyRoleSchema = z.enum(['USER','MANAGER']);
export const membershipSchema = z.object({role:companyRoleSchema}).strict();
export const membersQuerySchema = z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
export const decisionsSchema = z.object({decisions:z.array(z.discriminatedUnion('action',[
  z.object({companyId:z.number().int().positive(),action:z.literal('approve'),role:companyRoleSchema}).strict(),
  z.object({companyId:z.number().int().positive(),action:z.literal('reject')}).strict(),
])).min(1).max(10000).refine(rows => new Set(rows.map(row => row.companyId)).size===rows.length,'Empresas duplicadas.')}).strict();
