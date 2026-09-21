import * as repo from './companies.repository.js';
import * as auth from '../auth/auth.repository.js';
import { AppError, requireRecord } from '../../shared/errors/AppError.js';
import { membershipSchema, decisionsSchema } from './companies.validator.js';
import { notifyAccessChanged } from '../auth/auth.events.js';

const forbidden = () => new AppError(403,'COMPANY_FORBIDDEN','Você não administra esta empresa.');
// Re-read the actor inside the same transaction as the protected action.
export async function administrationScope(actor) {
  const current = actor && await auth.byId(actor.id);
  if (!current || current.access_status!=='active') throw forbidden();
  if (current.role==='admin') return {actor:current,global:true,companyIds:[]};
  const companyIds = (await repo.userCompanies(current.id)).filter(row => row.role==='MANAGER').map(row => row.id);
  if (!companyIds.length) throw forbidden();
  return {actor:current,global:false,companyIds};
}
export async function authorizeCompany(actor,companyId) {
  const scope = await administrationScope(actor);
  if (!scope.global && !scope.companyIds.includes(companyId)) throw forbidden();
  requireRecord(await repo.companyExists(companyId),'Empresa');
  return scope;
}
export async function authorizeGlobalAdministrator(actor) {
  const scope = await administrationScope(actor);
  if (!scope.global) throw forbidden();
  return scope;
}
export async function managedCompanies(actor) {
  return auth.atomic(async () => {
    const scope = await administrationScope(actor);
    return scope.global ? repo.publicCompanies() : (await repo.userCompanies(actor.id)).filter(row => scope.companyIds.includes(row.id));
  });
}
export async function listCompanyUsers(actor,companyId,page) {
  return auth.atomic(async () => {
    await authorizeCompany(actor,companyId);
    return {items:await repo.companyUsers(companyId,page),total:(await repo.companyUsersCount(companyId)).n};
  });
}
async function auditMembership(actor,userId,companyId,oldRole,newRole) {
  if (oldRole===newRole) return;
  await auth.recordCompanyAction(!oldRole ? 'company_user_added' : !newRole ? 'company_user_removed' : 'company_role_changed',
    actor,userId,companyId,{oldRole,newRole});
}
export async function changeMembership(actor,companyId,userId,input) {
  const {role} = membershipSchema.parse(input);
  const result = await auth.atomic(async () => {
    const scope = await authorizeCompany(actor,companyId);
    const previous = await repo.membership(userId,companyId);
    // Managers may edit members, never discover or attach an arbitrary global ID.
    if (!scope.global && !previous) throw forbidden();
    const user = requireRecord(await auth.byId(userId),'Usuário');
    if (!['active','blocked'].includes(user.access_status)) throw new AppError(409,'ACCESS_CONFLICT','Avalie a solicitação de acesso primeiro.');
    await protectLastManager(scope,userId,companyId,previous?.role,role);
    await repo.setMembership(userId,companyId,role);
    await auditMembership(scope.actor,userId,companyId,previous?.role ?? null,role);
    return {userId,companyId,role};
  });
  notifyAccessChanged();
  return result;
}
async function protectLastManager(scope,userId,companyId,oldRole,newRole) {
  if (!scope.global && userId===scope.actor.id && oldRole==='MANAGER' && newRole!=='MANAGER' && (await repo.activeManagers(companyId)).n<=1)
    throw new AppError(409,'LAST_COMPANY_MANAGER','Mantenha outro gerente ativo antes de remover seu próprio acesso de gerente.');
}
export async function removeCompanyUser(actor,companyId,userId) {
  await auth.atomic(async () => {
    const scope = await authorizeCompany(actor,companyId);
    const previous = await repo.membership(userId,companyId);
    if (!previous) { if (!scope.global) throw forbidden(); return; }
    await protectLastManager(scope,userId,companyId,previous.role,null);
    await repo.removeMembership(userId,companyId);
    await auditMembership(scope.actor,userId,companyId,previous.role,null);
  });
  notifyAccessChanged();
}
export async function decideAccess(actor,userId,input,{notify=true}={}) {
  const {decisions} = decisionsSchema.parse(input);
  const result = await auth.atomic(async () => {
    // Authorize every requested company before looking up the target or writing.
    let scope;
    for (const decision of decisions) scope = await authorizeCompany(actor,decision.companyId);
    const requests = await repo.requestCompanies(userId);
    for (const decision of decisions) {
      const row = requests.find(row => row.id===decision.companyId);
      if (!row) throw new AppError(403,'REQUEST_FORBIDDEN','Solicitação não disponível para esta empresa.');
      const status = decision.action==='approve' ? 'approved' : 'rejected';
      const role = decision.role ?? null;
      if (row.status!=='pending') {
        if (row.status===status && row.companyRole===role) continue;
        throw new AppError(409,'DECISION_CONFLICT','Esta empresa já foi avaliada. Atualize a solicitação.');
      }
      const previous = await repo.membership(userId,row.id);
      await repo.decideRequestedCompany(userId,row.id,status,role,scope.actor.id);
      if (status==='approved') {
        // An existing membership must never be downgraded by a stale approval.
        if (!previous) {
          await repo.setMembership(userId,row.id,role);
          await auditMembership(scope.actor,userId,row.id,null,role);
        }
      }
      await auth.recordCompanyAction(status==='approved' ? 'company_access_approved' : 'company_access_rejected',
        scope.actor,userId,row.id,{oldRole:previous?.role ?? null,newRole:status==='approved' ? previous?.role ?? role : previous?.role ?? null});
    }
    await repo.syncRequestAccount(userId,scope.actor.id);
    return (await repo.requestCompanies(userId)).filter(row => scope.global || scope.companyIds.includes(row.id));
  });
  if (notify) notifyAccessChanged();
  return result;
}

// Used by the existing global access editor, retaining enterprise roles on kept links.
export async function replaceMemberships(actor,userId,companyIds) {
  const before = await repo.userCompanies(userId);
  await repo.replaceUserCompanies(userId,companyIds);
  for (const company of before) if (!companyIds.includes(company.id)) await auditMembership(actor,userId,company.id,company.role,null);
  for (const id of companyIds) if (!before.some(company => company.id===id)) await auditMembership(actor,userId,id,null,'USER');
}
