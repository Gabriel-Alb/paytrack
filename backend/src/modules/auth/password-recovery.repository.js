import { repository } from '../../application/persistence.js';

export const expireRequests = (...args) => repository('password-recovery').expireRequests(...args);
export const pendingForUser = (...args) => repository('password-recovery').pendingForUser(...args);
export const createRequest = (...args) => repository('password-recovery').createRequest(...args);
export const byId = (...args) => repository('password-recovery').byId(...args);
export const resolveRequest = (...args) => repository('password-recovery').resolveRequest(...args);
export const invalidatePending = (...args) => repository('password-recovery').invalidatePending(...args);
export const saveTemporaryPassword = (...args) => repository('password-recovery').saveTemporaryPassword(...args);
export const clearTemporaryPassword = (...args) => repository('password-recovery').clearTemporaryPassword(...args);
export const list = (...args) => repository('password-recovery').list(...args);
export const pendingNotifications = (...args) => repository('password-recovery').pendingNotifications(...args);
