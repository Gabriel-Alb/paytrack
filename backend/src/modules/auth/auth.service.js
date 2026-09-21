import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import * as repo from './auth.repository.js';
import { authConfig } from '../../config/auth.js';
import { AppError, requireRecord } from '../../shared/errors/AppError.js';
import { requestSchema, profileSchema, accessSchema } from './auth.validator.js';
import { notifyAccessChanged } from './auth.events.js';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const hashPassword = (password) => argon2.hash(password, {type: argon2.argon2id,...authConfig.password});
let dummyHash;
const dummy = () => dummyHash ??= hashPassword(randomBytes(32).toString('base64url'));
export const prepareAuth = async () => { await dummy(); };
export async function verifyPassword(hash,password) {
  if (!hash?.startsWith('$argon2id$')) { await argon2.verify(await dummy(),password); return false; }
  try { return await argon2.verify(hash,password); }
  catch { await argon2.verify(await dummy(),password); return false; }
}
import { userCompanies, companyExists, addRequestedCompany, requestCompanies } from '../companies/companies.repository.js';
import { administrationScope, decideAccess, replaceMemberships } from '../companies/companies.service.js';

export const safeUser = async (user) => {
  const companies = (await userCompanies(user.id));
  return {id:user.id,name:user.name,email:user.email,role:user.role,accessStatus:user.access_status,companies,companyIds:companies.map(company=>company.id),managedCompanyIds:companies.filter(company=>company.role==='MANAGER').map(company=>company.id)};
};
export const profileUser = async (user) => ({...(await safeUser(user)),cpf:user.cpf,rg:user.rg});
export async function updateProfile(user,input) {
  const {email} = profileSchema.parse(input);
  let result;
  try {
    result = (await repo.atomic(async () => {
      (await repo.saveEmail(user.id,email));
      (await repo.audit('profile_updated',user.id,user.id));
      return (await profileUser((await repo.byId(user.id))));
    }));
  } catch (error) {
    if (error.code !== 'PERSISTENCE_UNIQUE') throw error;
    throw new AppError(409,'EMAIL_CONFLICT','Este e-mail já está cadastrado.');
  }
  notifyAccessChanged();
  return result;
}
const invalidCredentials = () => new AppError(401,'INVALID_CREDENTIALS','E-mail ou senha inválidos.');
export async function newSession(userId=null) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const now = Date.now();
  (await repo.insertSession({userId,tokenHash:hashToken(token),csrfToken,now,expiresAt:now+(userId ? authConfig.absoluteMs : authConfig.anonymousMs)}));
  return {token,csrfToken};
}
export async function resolveSession(token) {
  if (!token || !/^[\w-]{43}$/.test(token)) return null;
  const session = (await repo.sessionByHash(hashToken(token)));
  const now = Date.now();
  if (!session || session.revoked_at || session.expires_at<=now || session.last_seen_at+authConfig.idleMs<=now) return null;
  const user = session.user_id ? (await repo.byId(session.user_id)) : null;
  if (session.user_id && user?.access_status!=='active') return null;
  return {session,user};
}
export function validCsrf(session, token) {
  return typeof token==='string' && /^[\w-]{43}$/.test(token) && timingSafeEqual(Buffer.from(session.csrf_token),Buffer.from(token));
}
export async function requestAccess(data) {
  data = requestSchema.parse(data);
  const passwordHash = await hashPassword(data.password);
  try {
    (await repo.atomic(async () => {
      for (const companyId of data.companyIds ?? []) if (!await companyExists(companyId)) throw new AppError(400,'INVALID_COMPANY','Uma das empresas selecionadas não existe.');
      const id = (await repo.insertUser({...data,passwordHash},'user','pending'));
      for (const companyId of data.companyIds ?? []) await addRequestedCompany(id,companyId);
      (await repo.audit('access_requested',null,id));
    }));
  } catch (error) {
    if (error.code!=='PERSISTENCE_UNIQUE') throw error;
    throw new AppError(409,'ACCESS_REQUEST_CONFLICT','Não foi possível registrar a solicitação: e-mail ou documento já cadastrado. Confira seus dados ou entre em contato com o administrador.');
  }
  notifyAccessChanged();
}
export async function createMaster(input) {
  const data = requestSchema.parse(input);
  if ((await repo.hasMaster())) throw new AppError(409,'MASTER_EXISTS','Já existe um administrador.');
  const passwordHash = await hashPassword(data.password);
  return (await repo.atomic(async () => {
    if ((await repo.hasMaster())) throw new AppError(409,'MASTER_EXISTS','Já existe um administrador.');
    const id = (await repo.insertUser({...data,passwordHash},'admin','active'));
    (await repo.audit('admin_created',id,id));
    return (await safeUser((await repo.byId(id))));
  }));
}
export async function login(data,oldSession) {
  const user = (await repo.byEmail(data.email));
  if (!await verifyPassword(user?.password_hash,data.password)) {
    (await repo.audit('login_failure'));
    throw invalidCredentials();
  }
  return (await repo.atomic(async () => {
    const current = (await repo.byId(user.id));
    if (current.password_hash!==user.password_hash) throw invalidCredentials();
    const messages = {pending:'Sua solicitação ainda está aguardando aprovação.',rejected:'Sua solicitação de acesso foi rejeitada.',blocked:'Seu acesso está bloqueado.'};
    if (current.access_status!=='active') {
      (await repo.audit('login_failure',null,user.id));
      return {denied:new AppError(403,`ACCESS_${current.access_status.toUpperCase()}`,messages[current.access_status])};
    }
    if (oldSession) (await repo.revoke(oldSession.id));
    const session = (await newSession(user.id));
    (await repo.lastLogin(user.id));
    (await repo.audit('login_success',user.id,user.id));
    return {...session,user:(await safeUser(current))};
  }));
}
export async function logout(session,user,all=false) {
  (await repo.atomic(async () => {
    if (all) (await repo.revokeAll(user.id)); else (await repo.revoke(session.id));
    (await repo.audit(all ? 'sessions_revoked' : 'logout',user.id,user.id));
  }));
}
export async function changePassword(user,session,data) {
  const original = (await repo.byId(user.id));
  if (!await verifyPassword(original.password_hash,data.currentPassword)) throw invalidCredentials();
  const hash = await hashPassword(data.newPassword);
  (await repo.atomic(async () => {
    const current = (await repo.byId(user.id));
    const currentSession = (await repo.sessionByHash(session.token_hash));
    if (current.password_hash!==original.password_hash || current.access_status!=='active' || !currentSession || currentSession.revoked_at || currentSession.expires_at<=Date.now() || currentSession.last_seen_at+authConfig.idleMs<=Date.now())
      throw new AppError(401,'UNAUTHENTICATED','Entre novamente para continuar.');
    (await repo.savePassword(user.id,hash));
    (await repo.revokeAll(user.id));
    (await repo.audit('password_changed',user.id,user.id));
    (await repo.audit('sessions_revoked',user.id,user.id));
  }));
}
export async function reviewUser(id,actor) {
  return repo.atomic(async () => {
    const scope = await administrationScope(actor);
    const companies = (await userCompanies(id)).filter(row => scope.global || scope.companyIds.includes(row.id));
    const requests = (await requestCompanies(id)).filter(row => scope.global || scope.companyIds.includes(row.id));
    if (!scope.global && !companies.length && !requests.length) throw new AppError(403,'COMPANY_FORBIDDEN','Usuário fora das empresas administradas.');
    const user = requireRecord(await repo.byId(id),'Usuário');
    const requestStatus = requests.some(row => row.status==='pending') ? 'pending' : requests.some(row => row.status==='approved') ? 'approved' : requests.length ? 'rejected' : null;
    return {id:user.id,name:user.name,email:user.email,role:user.role,accessStatus:user.access_status,companies,companyIds:companies.map(row=>row.id),requests,requestStatus,
      ...(scope.global ? {cpf:user.cpf,rg:user.rg,cnh:user.cnh} : {}),createdAt:user.created_at};
  });
}
export async function changeAccess(actor,id,input) {
  if (actor.role !== 'admin') throw new AppError(403,'FORBIDDEN','Você não tem permissão para esta ação.');
  const {action,role,companyIds} = accessSchema.parse(input);
  const result = (await repo.atomic(async () => {
    if (!(await administrationScope(actor)).global) throw new AppError(403,'FORBIDDEN','Somente administradores alteram o acesso global.');
    const user = requireRecord((await repo.byId(id)),'Usuário');
    const requests = await requestCompanies(id);
    if (requests.length && ['approve','reject'].includes(action)) {
      if (role && role!=='user') throw new AppError(400,'GLOBAL_ROLE_SEPARATE','Aprove o acesso empresarial antes de alterar o nível global.');
      const pending = requests.filter(row => row.status==='pending');
      if (!pending.length) throw new AppError(409,'ACCESS_CONFLICT','O status mudou. Atualize a lista.');
      if (action==='approve' && companyIds.some(companyId => !pending.some(row=>row.id===companyId))) throw new AppError(400,'INVALID_COMPANY','Selecione apenas empresas pendentes da solicitação.');
      await decideAccess(actor,id,{decisions:pending.map(row => action==='approve' && companyIds.includes(row.id)
        ? {companyId:row.id,action:'approve',role:'USER'} : {companyId:row.id,action:'reject'})},{notify:false});
      return safeUser(await repo.byId(id));
    }
    const expected = {approve:'pending',reject:'pending',block:'active',unblock:'blocked'}[action];
    if (action === 'edit' ? !['active','blocked'].includes(user.access_status) : user.access_status!==expected) throw new AppError(409,'ACCESS_CONFLICT','O status mudou. Atualize a lista.');
    if (user.id===actor.id) throw new AppError(409,'SELF_ACCESS_CHANGE','Não é possível alterar o próprio acesso.');
    if (user.role === 'admin' && user.access_status === 'active' && (action === 'block' || (action === 'edit' && role === 'user')) && !(await repo.hasOtherActiveAdmin(id)))
      throw new AppError(409,'LAST_ADMIN','Mantenha pelo menos um administrador ativo.');
    if (action === 'approve' || action === 'edit') (await replaceMemberships(actor,id,companyIds));
    if (action === 'unblock' && user.role === 'user' && !(await userCompanies(id)).length)
      throw new AppError(400,'COMPANY_REQUIRED','Vincule pelo menos uma empresa antes de desbloquear.');
    (await repo.setAccess(id,action,actor.id,role));
    if (action !== 'edit') (await repo.revokeAll(id));
    (await repo.audit({edit:'access_updated',approve:'access_approved',reject:'access_rejected',block:'user_blocked',unblock:'user_unblocked'}[action],actor.id,id));
    if (action !== 'edit') (await repo.audit('sessions_revoked',actor.id,id));
    return (await safeUser((await repo.byId(id))));
  }));
  notifyAccessChanged();
  return result;
}
export const listUsers = (query,actor) => repo.atomic(async () => repo.listUsers(query,await administrationScope(actor)));
export const pendingNotifications = actor => repo.atomic(async () => {
  try { return await repo.pendingNotifications(await administrationScope(actor)); }
  catch (error) { if (error.code==='COMPANY_FORBIDDEN') return []; throw error; }
});
