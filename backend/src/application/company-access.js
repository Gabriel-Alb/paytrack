import { AsyncLocalStorage } from 'node:async_hooks';
import { repository } from './persistence.js';
import { AppError } from '../shared/errors/AppError.js';

const context = new AsyncLocalStorage();
export const withCompanyAccess = (access, operation) => context.run(access, operation);
export const companyAccessContext = () => context.getStore();
export function canAccessCompany(id) {
  const access = context.getStore();
  return Number(!access || access.role === 'admin' || access.companyIds.includes(id));
}
export async function resolveCompany(id) {
  const access = context.getStore();
  if (id === undefined) {
    if (!access) id = 1;
    else if (access.role === 'user' && access.companyIds.length === 1) id = access.companyIds[0];
    else throw new AppError(400, 'COMPANY_REQUIRED', 'Selecione a empresa responsável.');
  }
  if (!canAccessCompany(id) || !await repository('companies').companyExists(id))
    throw new AppError(403, 'COMPANY_FORBIDDEN', 'Empresa não disponível para este acesso.');
  return id;
}
