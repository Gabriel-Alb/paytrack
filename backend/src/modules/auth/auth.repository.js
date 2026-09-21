import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const atomic = (...args) => repository('auth').atomic(...args);
export const byEmail = (...args) => repository('auth').byEmail(...args);
export const byId = (...args) => repository('auth').byId(...args);
export const hasMaster = (...args) => repository('auth').hasMaster(...args);
export const hasOtherActiveAdmin = (...args) => repository('auth').hasOtherActiveAdmin(...args);
export const insertUser = (...args) => repository('auth').insertUser(...args);
export const audit = (...args) => repository('auth').audit(...args);
export const recordAction = (...args) => repository('auth').recordAction(...args);
export const recordCompanyAction = (...args) => repository('auth').recordCompanyAction(...args);
export const sessionByHash = (...args) => repository('auth').sessionByHash(...args);
export const insertSession = (...args) => repository('auth').insertSession(...args);
export const touch = (...args) => repository('auth').touch(...args);
export const revoke = (...args) => repository('auth').revoke(...args);
export const revokeAll = (...args) => repository('auth').revokeAll(...args);
export const lastLogin = (...args) => repository('auth').lastLogin(...args);
export const savePassword = (...args) => repository('auth').savePassword(...args);
export const saveEmail = (...args) => repository('auth').saveEmail(...args);
export const setAccess = (...args) => repository('auth').setAccess(...args);
export const listUsers = (...args) => repository('auth').listUsers(...args);
export const pendingNotifications = (...args) => repository('auth').pendingNotifications(...args);
export const cleanup = (...args) => repository('auth').cleanup(...args);
