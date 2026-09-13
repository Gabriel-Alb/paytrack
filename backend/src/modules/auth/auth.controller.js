import * as service from './auth.service.js';
import * as validator from './auth.validator.js';
import { idSchema } from '../../shared/utils/validation.js';
import { authConfig, cookieOptions } from '../../config/auth.js';
import { accessEvents } from './auth.events.js';
import { loadSession } from './auth.middleware.js';

function setCookie(res,token,authenticated) {
  res.cookie(authConfig.cookieName,token,{...cookieOptions,maxAge:authenticated ? authConfig.absoluteMs : authConfig.anonymousMs});
}
const clearCookie = (res) => res.clearCookie(authConfig.cookieName,cookieOptions);
export function csrf(req,res) {
  if (req.authSession) return res.json({csrfToken:req.authSession.csrf_token});
  const session=service.newSession();
  setCookie(res,session.token,false);
  res.json({csrfToken:session.csrfToken});
}
export async function requestAccess(req,res) {
  await service.requestAccess(validator.requestSchema.parse(req.body));
  res.status(202).json({message:'Solicitação registrada. Aguarde a avaliação do administrador.'});
}
export async function login(req,res) {
  const result=await service.login(validator.loginSchema.parse(req.body),req.authSession);
  if (result.denied) throw result.denied;
  setCookie(res,result.token,true);
  res.json({user:result.user,csrfToken:result.csrfToken});
}
export const me = (req,res) => res.json({user:service.profileUser(req.user)});
export const updateProfile = (req,res) => res.json({user:service.updateProfile(req.user,req.body)});
export function logout(req,res) {
  service.logout(req.authSession,req.user,req.path==='/logout-all');
  clearCookie(res);
  res.json({message:'Sessão encerrada.'});
}
export async function changePassword(req,res) {
  await service.changePassword(req.user,req.authSession,validator.changePasswordSchema.parse(req.body));
  clearCookie(res);
  res.json({message:'Senha alterada. Entre novamente.'});
}
export const listUsers = (req,res) => res.json(service.listUsers(validator.usersQuerySchema.parse(req.query)));
export function watchUsers(req,res) {
  res.set({'Content-Type':'text/event-stream','X-Accel-Buffering':'no'});
  res.flushHeaders();
  const refresh = () => {
    loadSession(req,res,() => {});
    if (!['admin'].includes(req.user?.role)) { res.end(); return; }
    res.write('data: refresh\n\n');
  };
  accessEvents.on('changed',refresh);
  // Recheck the session and refresh after reconnects or changes by another process.
  const heartbeat = setInterval(refresh,15000);
  res.on('close',() => { clearInterval(heartbeat);accessEvents.off('changed',refresh); });
  refresh();
}
export const reviewUser = (req,res) => res.json(service.reviewUser(idSchema.parse(req.params.id)));
export const changeAccess = (req,res) => res.json(service.changeAccess(req.user,idSchema.parse(req.params.id),req.body));
