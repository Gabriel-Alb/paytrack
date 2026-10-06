import { database } from "../connection.js";

export async function findFee(id) {
  return (await database().prepare("SELECT * FROM scoped_late_fees WHERE id=?").get(id));
}

export async function addWaiver(id, amount) {
  await database().prepare('UPDATE late_fees SET waived_amount=waived_amount+?, updated_at=utc_now() WHERE id=?').run(amount, id);
}

export async function listWaivers(loanId) {
  const rows = await database().prepare(`SELECT id,actor_id,actor_name,created_at,details FROM scoped_auth_audit_logs
    WHERE entity_type='loan' AND entity_id=? AND event='late_fee_waived' ORDER BY id`).all(loanId);
  return rows.map(({ details, ...row }) => ({ ...row, ...JSON.parse(details) }));
}
