import { database } from '../connection.js';

export const expireRequests = now => database().prepare("UPDATE password_reset_requests SET status='expired',resolved_at=? WHERE status='pending' AND expires_at<=?").run(now,now);
export const pendingForUser = id => database().prepare("SELECT id FROM password_reset_requests WHERE user_id=? AND status='pending'").get(id);
export const createRequest = (id,now,expires) => database().prepare('INSERT INTO password_reset_requests(user_id,requested_at,expires_at) VALUES(?,?,?)').run(id,now,expires);
export const byId = id => database().prepare('SELECT * FROM password_reset_requests WHERE id=?').get(id);
export const resolveRequest = (id,status,actorId,now) => database().prepare("UPDATE password_reset_requests SET status=?,resolved_by=?,resolved_at=? WHERE id=? AND status='pending'").run(status,actorId,now,id);
export const invalidatePending = (id,now) => database().prepare("UPDATE password_reset_requests SET status='expired',resolved_at=? WHERE user_id=? AND status='pending'").run(now,id);
export const saveTemporaryPassword = (id,hash,expires) => database().prepare('UPDATE users SET password_hash=?,must_change_password=1,temporary_password_expires_at=?,password_changed_at=utc_now(),updated_at=utc_now() WHERE id=?').run(hash,expires,id);
export const clearTemporaryPassword = id => database().prepare('UPDATE users SET must_change_password=0,temporary_password_expires_at=NULL WHERE id=?').run(id);
export async function list({status,page}) {
  const items = await database().prepare(`SELECT r.id,r.user_id AS "userId",u.name,u.email,r.status,
    r.requested_at AS "requestedAt",r.expires_at AS "expiresAt",r.resolved_at AS "resolvedAt",
    r.resolved_by AS "resolvedBy",a.name AS "resolvedByName"
    FROM password_reset_requests r JOIN users u ON u.id=r.user_id LEFT JOIN users a ON a.id=r.resolved_by
    WHERE r.status=? ORDER BY r.id DESC LIMIT 50 OFFSET ?`).all(status,(page-1)*50);
  return {items,total:(await database().prepare('SELECT count(*) n FROM password_reset_requests WHERE status=?').get(status)).n};
}
export const pendingNotifications = now => database().prepare(`SELECT 'recovery-' || r.id AS id,'recovery' AS type,u.name AS customer,r.requested_at AS "requestedAt"
  FROM password_reset_requests r JOIN users u ON u.id=r.user_id WHERE r.status='pending' AND r.expires_at>? ORDER BY r.id DESC LIMIT 100`).all(now);
