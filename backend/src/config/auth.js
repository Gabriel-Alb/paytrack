import { env } from './env.js';

export const authConfig = Object.freeze({
  production: env.NODE_ENV === 'production',
  cookieName: env.NODE_ENV === 'production' ? '__Host-paytrack_session' : 'paytrack_session',
  absoluteMs: env.SESSION_MAX_AGE * 1000,
  idleMs: Math.min(env.SESSION_IDLE_AGE, env.SESSION_MAX_AGE) * 1000,
  anonymousMs: 30 * 60 * 1000,
  password: { memoryCost: 19456, timeCost: 2, parallelism: 1 },
  limits: { requestAccount: 3, passwordIp: 10, passwordUser: 5, csrfIp: 100 },
});

export const cookieOptions = {
  httpOnly: true, secure: authConfig.production, sameSite: env.COOKIE_SAME_SITE, path: '/',
};
