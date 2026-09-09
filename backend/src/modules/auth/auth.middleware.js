import { isAllowedOrigin } from '../../config/origins.js';
import { authConfig } from '../../config/auth.js';
import { AppError } from '../../shared/errors/AppError.js';
import * as service from './auth.service.js';
import { touch } from './auth.repository.js';

export function loadSession(req,_res,next) {
  const cookie = req.headers.cookie?.split(';').map((part)=>part.trim()).find((part)=>part.startsWith(`${authConfig.cookieName}=`));
  const resolved = service.resolveSession(cookie?.slice(authConfig.cookieName.length+1));
  req.authSession = resolved?.session;
  req.user = resolved?.user;
  next();
}
export function requireAuth(req,_res,next) {
  if (!req.user) return next(new AppError(401,'UNAUTHENTICATED','Entre para continuar.'));
  if (Date.now()-req.authSession.last_seen_at>60000) touch(req.authSession.id,Date.now());
  next();
}
export const requireRole = (role) => (req,_res,next) => {
  if (req.user?.role!==role) return next(new AppError(403,'FORBIDDEN','Você não tem permissão para esta ação.'));
  next();
};
export function trustedOrigin(req,_res,next) {
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch { origin = 'invalid'; }
  }
  if (origin && !isAllowedOrigin(origin))
    return next(new AppError(403,'ORIGIN_REJECTED','Origem não autorizada.'));
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && !origin)
    return next(new AppError(403,'ORIGIN_REJECTED','Origem não autorizada.'));
  next();
}
export function requireCsrf(req,_res,next) {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  if (!req.authSession || !service.validCsrf(req.authSession,req.headers['x-csrf-token']))
    return next(new AppError(403,'CSRF_INVALID','A validação de segurança expirou. Tente novamente.'));
  next();
}
