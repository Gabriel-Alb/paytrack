import { database } from '../connection.js';
export async function increment(key, now, windowMs) {
    const row=(await database().prepare(`INSERT INTO auth_rate_limits(key,hits,reset_at) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN auth_rate_limits.reset_at<=? THEN 1 ELSE auth_rate_limits.hits+1 END,
      reset_at=CASE WHEN auth_rate_limits.reset_at<=? THEN excluded.reset_at ELSE auth_rate_limits.reset_at END RETURNING hits,reset_at`)
      .get(key,now+windowMs,now,now));
  return row;
}
export const decrement = async key => (await database().prepare('UPDATE auth_rate_limits SET hits=greatest(0,hits-1) WHERE key=?').run(key));
export const resetKey = async key => (await database().prepare('DELETE FROM auth_rate_limits WHERE key=?').run(key));
