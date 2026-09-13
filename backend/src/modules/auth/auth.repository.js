import { database } from '../../config/database.js';

export const atomic = (operation) => database().transaction(operation).immediate();
export const byEmail = (email) => database().prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(email);
export const byId = (id) => database().prepare('SELECT * FROM users WHERE id=?').get(id);
export const hasMaster = () => !!database().prepare("SELECT 1 FROM users WHERE role='admin'").get();
export const hasOtherActiveAdmin = id => !!database().prepare("SELECT 1 FROM users WHERE role='admin' AND access_status='active' AND id<>?").get(id);
export function insertUser({name,email,cpf,rg=null,cnh=null,passwordHash}, role, status) {
  return Number(database().prepare(`INSERT INTO users (name,email,cpf,rg,cnh,password_hash,role,access_status,password_changed_at)
    VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).run(name,email,cpf,rg,cnh,passwordHash,role,status).lastInsertRowid);
}
export function audit(event, actorId = null, subjectId = null) {
  database().prepare('INSERT INTO auth_audit_logs(event,actor_id,subject_id,created_at) VALUES (?,?,?,?)')
    .run(event,actorId,subjectId,Date.now());
}
// Actor is supplied by the authenticated controller, never by the request body.
// Offline seed operations have no authenticated actor; do not invent one.
export function recordAction(event, actor, entityType, entityId, details) {
  if (!actor) return;
  const user = byId(actor.id);
  if (!user) throw new Error('Responsável não encontrado.');
  database().prepare(`INSERT INTO auth_audit_logs(event,actor_id,actor_name,entity_type,entity_id,details,created_at)
    VALUES (?,?,?,?,?,?,?)`).run(event,user.id,user.name,entityType,entityId,JSON.stringify(details),Date.now());
}
export const sessionByHash = (hash) => database().prepare('SELECT * FROM auth_sessions WHERE token_hash=?').get(hash);
export function insertSession({userId,tokenHash,csrfToken,now,expiresAt}) {
  database().prepare(`INSERT INTO auth_sessions(user_id,token_hash,csrf_token,created_at,expires_at,last_seen_at)
    VALUES (?,?,?,?,?,?)`).run(userId,tokenHash,csrfToken,now,expiresAt,now);
}
export const touch = (id, now) => database().prepare('UPDATE auth_sessions SET last_seen_at=? WHERE id=? AND revoked_at IS NULL').run(now,id);
export const revoke = (id) => database().prepare('UPDATE auth_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL').run(Date.now(),id);
export const revokeAll = (id) => database().prepare('UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(Date.now(),id);
export const lastLogin = (id) => database().prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
export const savePassword = (id,hash) => database().prepare('UPDATE users SET password_hash=?,password_changed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(hash,id);
export const saveEmail = (id,email) => database().prepare('UPDATE users SET email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(email,id);
export function setAccess(id, action, actorId, role) {
  const updates = {
    approve: "access_status='active',role=@role,approved_by=@actorId,approved_at=CURRENT_TIMESTAMP",
    edit: "role=@role",
    reject: "access_status='rejected',rejected_at=CURRENT_TIMESTAMP",
    block: "access_status='blocked',blocked_at=CURRENT_TIMESTAMP",
    unblock: "access_status='active',blocked_at=NULL",
  };
  database().prepare(`UPDATE users SET ${updates[action]},updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({id,actorId,role:role ?? null});
}
export function listUsers({status,page}) {
  return {items: database().prepare(`SELECT id,name,email,role,access_status AS accessStatus,created_at AS createdAt
    FROM users WHERE access_status=? ORDER BY id DESC LIMIT 50 OFFSET ?`).all(status,(page-1)*50),
  total: database().prepare('SELECT count(*) n FROM users WHERE access_status=?').get(status).n};
}
export const pendingNotifications = () => database().prepare(`SELECT 'access-' || id AS id,id AS userId,
  'access' AS type,name AS customer,created_at AS datetime FROM users WHERE access_status='pending' ORDER BY id DESC LIMIT 100`).all();
export function cleanup() {
  const now = Date.now();
  database().prepare('DELETE FROM auth_sessions WHERE expires_at<? OR revoked_at<?').run(now,now-86400000);
  database().prepare('DELETE FROM auth_rate_limits WHERE reset_at<?').run(now);
}
