import * as service from './auth.service.js';
import * as validator from './auth.validator.js';
import { idSchema } from '../../shared/utils/validation.js';
import { authConfig, cookieOptions } from '../../config/auth.js';
import { accessEvents } from './auth.events.js';
import { loadSession } from './auth.middleware.js';
import { administrationScope, decideAccess } from '../companies/companies.service.js';

export function setCookie(res,token,authenticated) {
  res.cookie(authConfig.cookieName,token,{...cookieOptions,maxAge:authenticated ? authConfig.absoluteMs : authConfig.anonymousMs});
}
const clearCookie = (res) => res.clearCookie(authConfig.cookieName,cookieOptions);
export async function csrf(req,res) {
  if (req.authSession) return res.json({csrfToken:req.authSession.csrf_token});
  const session=(await service.newSession());
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
export const me = async (req,res) => res.json({user:(await service.profileUser(req.user))});
export const updateProfile = async (req,res) => res.json({user:(await service.updateProfile(req.user,req.body))});
export async function logout(req,res) {
  (await service.logout(req.authSession,req.user,req.path==='/logout-all'));
  clearCookie(res);
  res.json({message:'Sessão encerrada.'});
}
export async function changePassword(req,res) {
  await service.changePassword(req.user,req.authSession,validator.changePasswordSchema.parse(req.body));
  clearCookie(res);
  res.json({message:'Senha alterada. Entre novamente.'});
}
export const listUsers = async (req,res) => res.json((await service.listUsers(validator.usersQuerySchema.parse(req.query),req.user)));
export async function watchUsers(req,res) {
  await administrationScope(req.user);
  res.set({'Content-Type':'text/event-stream','X-Accel-Buffering':'no'});
  res.flushHeaders();
  const refresh = async () => {
    try {
      await loadSession(req,res,() => {});
      if (res.destroyed || res.writableEnded) return;
      await administrationScope(req.user);
      res.write('data: refresh\n\n');
    } catch { res.end(); }
  };
  accessEvents.on('changed',refresh);
  // Recheck the session and refresh after reconnects or changes by another process.
  const heartbeat = setInterval(refresh,15000);
  res.on('close',() => { clearInterval(heartbeat);accessEvents.off('changed',refresh); });
  refresh();
}
export const reviewUser = async (req,res) => res.json((await service.reviewUser(idSchema.parse(req.params.id),req.user)));
export const changeAccess = async (req,res) => res.json((await service.changeAccess(req.user,idSchema.parse(req.params.id),req.body)));
export const decideCompanyAccess = async (req,res) => res.json(await decideAccess(req.user,idSchema.parse(req.params.id),req.body));
