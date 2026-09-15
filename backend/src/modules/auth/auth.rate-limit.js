import { createHash } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { repository } from '../../application/persistence.js';
import { env } from '../../config/env.js';
import { authConfig } from '../../config/auth.js';

// Shared persistent counters survive restarts and concurrent workers using the same DB.
class PersistentRateStore {
  constructor(prefix) { this.prefix=prefix; }
  init(options) { this.windowMs=options.windowMs; }
  key(value) { return this.prefix+createHash('sha256').update(value).digest('hex'); }
  async increment(value) {
    const now=Date.now();
    const row=await repository('rate-limits').increment(this.key(value),now,this.windowMs);
    return {totalHits:row.hits,resetTime:new Date(row.reset_at)};
  }
  async decrement(value) { await repository('rate-limits').decrement(this.key(value)); }
  async resetKey(value) { await repository('rate-limits').resetKey(this.key(value)); }
}
function limiter(prefix,limit,keyGenerator) {
  return rateLimit({windowMs:env.AUTH_WINDOW_MS,limit,store:new PersistentRateStore(prefix),
    standardHeaders:false,legacyHeaders:false,...(keyGenerator ? {keyGenerator} : {}),
    message:{error:{code:'TOO_MANY_ATTEMPTS',message:'Muitas tentativas. Aguarde alguns minutos e tente novamente.'}},
  });
}
const identifier = (req) => typeof req.body?.email==='string' ? req.body.email.trim().toLowerCase().slice(0,254) : 'invalid';
export const loginLimits = [limiter('login-ip:',env.AUTH_LOGIN_IP_LIMIT),limiter('login-account:',env.AUTH_LOGIN_ACCOUNT_LIMIT,identifier)];
export const requestLimits = [limiter('request-ip:',env.AUTH_REQUEST_IP_LIMIT),limiter('request-account:',authConfig.limits.requestAccount,identifier)];
export const passwordLimits = [limiter('password-ip:',authConfig.limits.passwordIp),limiter('password-user:',authConfig.limits.passwordUser,(req)=>String(req.user.id))];
export const csrfLimit = limiter('csrf-ip:',authConfig.limits.csrfIp);
