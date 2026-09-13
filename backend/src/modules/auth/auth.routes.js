import { Router } from 'express';
import * as controller from './auth.controller.js';
import { requireAuth,requireCsrf,requireRole,trustedOrigin } from './auth.middleware.js';
import { csrfLimit,loginLimits,requestLimits,passwordLimits } from './auth.rate-limit.js';

export const authRoutes=Router();
authRoutes.get('/csrf',csrfLimit,trustedOrigin,controller.csrf);
authRoutes.post('/login',...loginLimits,trustedOrigin,requireCsrf,controller.login);
authRoutes.post('/request-access',...requestLimits,trustedOrigin,requireCsrf,controller.requestAccess);
authRoutes.use(requireAuth,trustedOrigin,requireCsrf);
authRoutes.get('/me',controller.me);
authRoutes.patch('/me',controller.updateProfile);
authRoutes.post('/logout',controller.logout);
authRoutes.post('/logout-all',controller.logout);
authRoutes.post('/change-password',...passwordLimits,controller.changePassword);

export const usersRoutes=Router();
usersRoutes.use(requireRole('admin'));
usersRoutes.get('/',controller.listUsers);
usersRoutes.get('/events',controller.watchUsers);
usersRoutes.get('/:id',controller.reviewUser);
usersRoutes.patch('/:id/access',controller.changeAccess);
