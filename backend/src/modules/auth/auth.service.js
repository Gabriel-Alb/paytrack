import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import * as repo from './auth.repository.js';
import { authConfig } from '../../config/auth.js';
import { AppError, requireRecord } from '../../shared/errors/AppError.js';
import { requestSchema, profileSchema, accessSchema } from './auth.validator.js';
import { accessEvents } from './auth.events.js';

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
export const safeUser = (user) => ({id:user.id,name:user.name,email:user.email,role:user.role,accessStatus:user.access_status});
export const profileUser = (user) => ({...safeUser(user),cpf:user.cpf,rg:user.rg});
export function updateProfile(user,input) {
  const {email} = profileSchema.parse(input);
  let result;
  try {
    result = repo.atomic(() => {
      repo.saveEmail(user.id,email);
      repo.audit('profile_updated',user.id,user.id);
      return profileUser(repo.byId(user.id));
    });
  } catch (error) {
    if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error;
    throw new AppError(409,'EMAIL_CONFLICT','Este e-mail já está cadastrado.');
  }
  accessEvents.emit('changed');
  return result;
}
const invalidCredentials = () => new AppError(401,'INVALID_CREDENTIALS','E-mail ou senha inválidos.');
export function newSession(userId=null) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const now = Date.now();
  repo.insertSession({userId,tokenHash:hashToken(token),csrfToken,now,expiresAt:now+(userId ? authConfig.absoluteMs : authConfig.anonymousMs)});
  return {token,csrfToken};
}
export function resolveSession(token) {
  if (!token || !/^[\w-]{43}$/.test(token)) return null;
  const session = repo.sessionByHash(hashToken(token));
  const now = Date.now();
  if (!session || session.revoked_at || session.expires_at<=now || session.last_seen_at+authConfig.idleMs<=now) return null;
  const user = session.user_id ? repo.byId(session.user_id) : null;
  if (session.user_id && user?.access_status!=='active') return null;
  return {session,user};
}
export function validCsrf(session, token) {
  return typeof token==='string' && /^[\w-]{43}$/.test(token) && timingSafeEqual(Buffer.from(session.csrf_token),Buffer.from(token));
}
export async function requestAccess(data) {
  const passwordHash = await hashPassword(data.password);
  try {
    repo.atomic(() => {
      const id = repo.insertUser({...data,passwordHash},'user','pending');
      repo.audit('access_requested',null,id);
    });
  } catch (error) {
    if (error.code!=='SQLITE_CONSTRAINT_UNIQUE') throw error;
    throw new AppError(409,'ACCESS_REQUEST_CONFLICT','Não foi possível registrar a solicitação: e-mail ou documento já cadastrado. Confira seus dados ou entre em contato com o administrador.');
  }
  accessEvents.emit('changed');
}
export async function createMaster(input) {
  const data = requestSchema.parse(input);
  if (repo.hasMaster()) throw new AppError(409,'MASTER_EXISTS','Já existe um master.');
  const passwordHash = await hashPassword(data.password);
  return repo.atomic(() => {
    if (repo.hasMaster()) throw new AppError(409,'MASTER_EXISTS','Já existe um master.');
    const id = repo.insertUser({...data,passwordHash},'master','active');
    repo.audit('master_created',id,id);
    return safeUser(repo.byId(id));
  });
}
export async function login(data,oldSession) {
  const user = repo.byEmail(data.email);
  if (!await verifyPassword(user?.password_hash,data.password)) {
    repo.audit('login_failure');
    throw invalidCredentials();
  }
  return repo.atomic(() => {
    const current = repo.byId(user.id);
    if (current.password_hash!==user.password_hash) throw invalidCredentials();
    const messages = {pending:'Sua solicitação ainda está aguardando aprovação.',rejected:'Sua solicitação de acesso foi rejeitada.',blocked:'Seu acesso está bloqueado.'};
    if (current.access_status!=='active') {
      repo.audit('login_failure',null,user.id);
      return {denied:new AppError(403,`ACCESS_${current.access_status.toUpperCase()}`,messages[current.access_status])};
    }
    if (oldSession) repo.revoke(oldSession.id);
    const session = newSession(user.id);
    repo.lastLogin(user.id);
    repo.audit('login_success',user.id,user.id);
    return {...session,user:safeUser(current)};
  });
}
export function logout(session,user,all=false) {
  repo.atomic(() => {
    if (all) repo.revokeAll(user.id); else repo.revoke(session.id);
    repo.audit(all ? 'sessions_revoked' : 'logout',user.id,user.id);
  });
}
export async function changePassword(user,session,data) {
  const original = repo.byId(user.id);
  if (!await verifyPassword(original.password_hash,data.currentPassword)) throw invalidCredentials();
  const hash = await hashPassword(data.newPassword);
  repo.atomic(() => {
    const current = repo.byId(user.id);
    const currentSession = repo.sessionByHash(session.token_hash);
    if (current.password_hash!==original.password_hash || current.access_status!=='active' || !currentSession || currentSession.revoked_at || currentSession.expires_at<=Date.now() || currentSession.last_seen_at+authConfig.idleMs<=Date.now())
      throw new AppError(401,'UNAUTHENTICATED','Entre novamente para continuar.');
    repo.savePassword(user.id,hash);
    repo.revokeAll(user.id);
    repo.audit('password_changed',user.id,user.id);
    repo.audit('sessions_revoked',user.id,user.id);
  });
}
export function reviewUser(id) {
  const user = requireRecord(repo.byId(id),'Usuário');
  return {...safeUser(user),cpf:user.cpf,rg:user.rg,cnh:user.cnh,createdAt:user.created_at};
}
export function changeAccess(actor,id,input) {
  if (!['master','admin'].includes(actor.role)) throw new AppError(403,'FORBIDDEN','Você não tem permissão para esta ação.');
  const {action,role} = accessSchema.parse(input);
  const result = repo.atomic(() => {
    const user = requireRecord(repo.byId(id),'Usuário');
    const expected = {approve:'pending',reject:'pending',block:'active',unblock:'blocked'}[action];
    if (user.access_status!==expected) throw new AppError(409,'ACCESS_CONFLICT','O status mudou. Atualize a lista.');
    if (user.id===actor.id) throw new AppError(409,'SELF_ACCESS_CHANGE','Não é possível alterar o próprio acesso.');
    if (user.role==='master' && actor.role!=='master') throw new AppError(403,'FORBIDDEN','Você não tem permissão para esta ação.');
    repo.setAccess(id,action,actor.id,role);
    repo.revokeAll(id);
    repo.audit({approve:'access_approved',reject:'access_rejected',block:'user_blocked',unblock:'user_unblocked'}[action],actor.id,id);
    repo.audit('sessions_revoked',actor.id,id);
    return safeUser(repo.byId(id));
  });
  accessEvents.emit('changed');
  return result;
}
export const listUsers = repo.listUsers;
export const pendingNotifications = repo.pendingNotifications;
