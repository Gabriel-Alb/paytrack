import { randomBytes } from 'node:crypto';
import * as repo from './password-recovery.repository.js';
import * as auth from './auth.repository.js';
import { hashPassword, verifyPassword, newSession, safeUser } from './auth.service.js';
import { authorizeGlobalAdministrator } from '../companies/companies.service.js';
import { userCompanies } from '../companies/companies.repository.js';
import { AppError, requireRecord } from '../../shared/errors/AppError.js';
import { authConfig } from '../../config/auth.js';
import { recoverySchema, requiredPasswordSchema } from './auth.validator.js';
import { notifyAccessChanged } from './auth.events.js';

export const publicMessage = 'Se os dados informados estiverem associados a uma conta válida, a solicitação de recuperação será registrada.';
const eligible = async user => user?.access_status==='active' && (user.role==='admin' || (await userCompanies(user.id)).length>0);
const conflict = () => new AppError(409,'RECOVERY_CONFLICT','Solicitação indisponível. Atualize a lista.');

export async function requestRecovery(input) {
  const {email} = recoverySchema.parse(input);
  await auth.atomic(async () => {
    await repo.expireRequests(Date.now());
    const user = await auth.byEmail(email);
    if (!await eligible(user) || await repo.pendingForUser(user.id)) return;
    const now = Date.now();
    await repo.createRequest(user.id,now,now+authConfig.recoveryRequestMs);
    await auth.audit('password_recovery_requested',null,user.id);
  });
  // Emit the same refresh for every valid identifier, never a public account signal.
  notifyAccessChanged();
  return {message:publicMessage};
}
export const listRequests = (actor,query) => auth.atomic(async () => {
  await authorizeGlobalAdministrator(actor);
  await repo.expireRequests(Date.now());
  return repo.list(query);
});

export async function decideRecovery(actor,id,action) {
  const result = await auth.atomic(async () => {
    await authorizeGlobalAdministrator(actor);
    const request = requireRecord(await repo.byId(id),'Solicitação');
    if (request.status!=='pending' || request.expires_at<=Date.now()) throw conflict();
    const user = requireRecord(await auth.byId(request.user_id),'Usuário');
    if (action==='reject') {
      await repo.resolveRequest(id,'rejected',actor.id,Date.now());
      await auth.audit('password_recovery_rejected',actor.id,user.id);
      return {message:'Solicitação rejeitada.'};
    }
    if (!await eligible(user)) throw conflict();
    if (user.id===actor.id) throw new AppError(409,'SELF_RECOVERY','Outro administrador deve redefinir sua senha.');
    const temporaryPassword = randomBytes(15).toString('base64url');
    const hash = await hashPassword(temporaryPassword);
    const now = Date.now(), expiresAt = now+authConfig.temporaryPasswordMs;
    await repo.saveTemporaryPassword(user.id,hash,expiresAt);
    await repo.resolveRequest(id,'completed',actor.id,now);
    await repo.invalidatePending(user.id,now);
    await auth.revokeAll(user.id);
    await auth.audit('password_recovery_approved',actor.id,user.id);
    await auth.audit('password_reset_by_admin',actor.id,user.id);
    await auth.audit('sessions_revoked',actor.id,user.id);
    return {temporaryPassword,expiresAt};
  });
  notifyAccessChanged();
  return result;
}

export async function changeRequiredPassword(user,session,input) {
  const {newPassword} = requiredPasswordSchema.parse(input);
  const original = await auth.byId(user.id);
  if (!original?.must_change_password) throw new AppError(409,'PASSWORD_CHANGE_NOT_REQUIRED','Não há troca obrigatória pendente.');
  if (await verifyPassword(original.password_hash,newPassword))
    throw new AppError(400,'PASSWORD_UNCHANGED','Escolha uma senha diferente da senha temporária.');
  const hash = await hashPassword(newPassword);
  const result = await auth.atomic(async () => {
    const current = await auth.byId(user.id);
    const currentSession = await auth.sessionByHash(session.token_hash);
    const now = Date.now();
    if (!current?.must_change_password || current.password_hash!==original.password_hash ||
      current.temporary_password_expires_at<=now || !await eligible(current) ||
      !currentSession || currentSession.revoked_at || currentSession.expires_at<=now || currentSession.last_seen_at+authConfig.idleMs<=now)
      throw new AppError(401,'UNAUTHENTICATED','Entre novamente para continuar.');
    await auth.savePassword(user.id,hash);
    await repo.clearTemporaryPassword(user.id);
    await repo.invalidatePending(user.id,now);
    await auth.revokeAll(user.id);
    await auth.audit('required_password_changed',user.id,user.id);
    await auth.audit('sessions_revoked',user.id,user.id);
    return {...await newSession(user.id),user:await safeUser(await auth.byId(user.id))};
  });
  notifyAccessChanged();
  return result;
}

export const recoveryNotifications = actor => auth.atomic(async () => {
  if (actor?.role!=='admin') return [];
  await authorizeGlobalAdministrator(actor);
  return (await repo.pendingNotifications(Date.now())).map(({requestedAt,...item}) => ({...item,datetime:new Date(requestedAt).toISOString()}));
});
