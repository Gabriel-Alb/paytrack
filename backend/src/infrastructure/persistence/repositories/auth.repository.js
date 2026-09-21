import { database } from '../connection.js';

export const atomic = async (operation) => (await database().transaction(operation));
export const byEmail = async (email) => (await database().prepare("SELECT * FROM users WHERE ascii_lower(email)=ascii_lower(?)").get(email));
export const byId = async (id) => (await database().prepare('SELECT * FROM users WHERE id=?').get(id));
export const hasMaster = async () => !!(await database().prepare("SELECT 1 FROM users WHERE role='admin'").get());
export const hasOtherActiveAdmin = async id => !!(await database().prepare("SELECT 1 FROM users WHERE role='admin' AND access_status='active' AND id<>?").get(id));
export async function insertUser({name,email,cpf,rg=null,cnh=null,passwordHash}, role, status) {
  return Number((await database().prepare(`INSERT INTO users (name,email,cpf,rg,cnh,password_hash,role,access_status,password_changed_at)
    VALUES (?,?,?,?,?,?,?,?,utc_now())`).run(name,email,cpf,rg,cnh,passwordHash,role,status)).lastInsertRowid);
}
export async function audit(event, actorId = null, subjectId = null) {
  (await database().prepare('INSERT INTO auth_audit_logs(event,actor_id,subject_id,created_at) VALUES (?,?,?,?)')
    .run(event,actorId,subjectId,Date.now()));
}
// Actor is supplied by the authenticated controller, never by the request body.
// Offline seed operations have no authenticated actor; do not invent one.
export async function recordAction(event, actor, entityType, entityId, details) {
  if (!actor) return;
  const user = (await byId(actor.id));
  if (!user) throw new Error('Responsável não encontrado.');
  (await database().prepare(`INSERT INTO auth_audit_logs(event,actor_id,actor_name,entity_type,entity_id,details,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(event,user.id,user.name,entityType,entityId,JSON.stringify(details),Date.now()));
}
export async function recordCompanyAction(event,actor,subjectId,companyId,details) {
  await database().prepare(`INSERT INTO auth_audit_logs(event,actor_id,subject_id,actor_name,entity_type,entity_id,details,created_at)
    VALUES(?,?,?,?,?,?,?,?)`).run(event,actor.id,subjectId,actor.name,'company',companyId,JSON.stringify({companyId,...details}),Date.now());
}
export const sessionByHash = async (hash) => (await database().prepare('SELECT * FROM auth_sessions WHERE token_hash=?').get(hash));
export async function insertSession({userId,tokenHash,csrfToken,now,expiresAt}) {
  (await database().prepare(`INSERT INTO auth_sessions(user_id,token_hash,csrf_token,created_at,expires_at,last_seen_at)
    VALUES (?,?,?,?,?,?)`).run(userId,tokenHash,csrfToken,now,expiresAt,now));
}
export const touch = async (id, now) => (await database().prepare('UPDATE auth_sessions SET last_seen_at=? WHERE id=? AND revoked_at IS NULL').run(now,id));
export const revoke = async (id) => (await database().prepare('UPDATE auth_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(Date.now(),id));
export const revokeAll = async (id) => (await database().prepare('UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(Date.now(),id));
export const lastLogin = async (id) => (await database().prepare("UPDATE users SET last_login_at=utc_now() WHERE id=?").run(id));
export const savePassword = async (id,hash) => (await database().prepare("UPDATE users SET password_hash=?,password_changed_at=utc_now(),updated_at=utc_now() WHERE id=?").run(hash,id));
export const saveEmail = async (id,email) => (await database().prepare("UPDATE users SET email=?,updated_at=utc_now() WHERE id=?").run(email,id));
export async function setAccess(id, action, actorId, role) {
  const updates = {
    approve: "access_status='active',role=@role,approved_by=@actorId,approved_at=utc_now()",
    edit: "role=@role",
    reject: "access_status='rejected',rejected_at=utc_now()",
    block: "access_status='blocked',blocked_at=utc_now()",
    unblock: "access_status='active',blocked_at=NULL",
  };
  (await database().prepare(`UPDATE users SET ${updates[action]},updated_at=utc_now() WHERE id=@id`).run({id,actorId,role:role ?? null}));
}
export async function listUsers({status,page},scope) {
  const companyFilter = scope.global ? '1=1' : `r.company_id IN (${scope.companyIds.map(() => '?').join(',')})`;
  const memberFilter = scope.global ? '1=1' : `uc.company_id IN (${scope.companyIds.map(() => '?').join(',')})`;
  const ids = scope.global ? [] : scope.companyIds;
  const filter = ['pending','rejected'].includes(status)
    ? `(EXISTS(SELECT 1 FROM user_access_companies r WHERE r.user_id=users.id AND r.status=? AND ${companyFilter})
      ${scope.global ? "OR (access_status=? AND NOT EXISTS(SELECT 1 FROM user_access_companies r WHERE r.user_id=users.id))" : ''})`
    : `access_status=? AND ${scope.global ? '1=1' : `EXISTS(SELECT 1 FROM user_companies uc WHERE uc.user_id=users.id AND ${memberFilter})`}`;
  const args = [status,...ids,...(['pending','rejected'].includes(status) && scope.global ? [status] : [])];
  return {items: (await database().prepare(`SELECT id,name,email,role,access_status AS "accessStatus",created_at AS "createdAt"
    FROM users WHERE ${filter} ORDER BY id DESC LIMIT 50 OFFSET ?`).all(...args,(page-1)*50)),
  total: (await database().prepare(`SELECT count(*) n FROM users WHERE ${filter}`).get(...args)).n};
}
export async function pendingNotifications(scope) {
  const filter = scope.global ? '1=1' : `r.company_id IN (${scope.companyIds.map(() => '?').join(',')})`;
  return database().prepare(`SELECT 'access-' || id AS id,id AS "userId",'access' AS type,name AS customer,created_at AS datetime FROM users
    WHERE EXISTS(SELECT 1 FROM user_access_companies r WHERE r.user_id=users.id AND r.status='pending' AND ${filter})
    ${scope.global ? "OR (access_status='pending' AND NOT EXISTS(SELECT 1 FROM user_access_companies r WHERE r.user_id=users.id))" : ''}
    ORDER BY id DESC LIMIT 100`).all(...(scope.global ? [] : scope.companyIds));
}
export async function cleanup() {
  const now = Date.now();
  (await database().prepare('DELETE FROM auth_sessions WHERE expires_at<? OR revoked_at<?').run(now,now-86400000));
  (await database().prepare('DELETE FROM auth_rate_limits WHERE reset_at<?').run(now));
}
