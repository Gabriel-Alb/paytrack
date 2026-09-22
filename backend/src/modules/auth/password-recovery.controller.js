import * as service from './password-recovery.service.js';
import { recoveryQuerySchema, recoveryDecisionSchema } from './auth.validator.js';
import { idSchema } from '../../shared/utils/validation.js';
import { setCookie } from './auth.controller.js';

export const requestRecovery = async (req,res) => res.status(202).json(await service.requestRecovery(req.body));
export const listRequests = async (req,res) => res.json(await service.listRequests(req.user,recoveryQuerySchema.parse(req.query)));
const decide = action => async (req,res) => {
  recoveryDecisionSchema.parse(req.body ?? {});
  res.json(await service.decideRecovery(req.user,idSchema.parse(req.params.id),action));
};
export const approve = decide('approve');
export const reject = decide('reject');
export async function changeRequiredPassword(req,res) {
  const result = await service.changeRequiredPassword(req.user,req.authSession,req.body);
  setCookie(res,result.token,true);
  res.json({user:result.user,csrfToken:result.csrfToken});
}
