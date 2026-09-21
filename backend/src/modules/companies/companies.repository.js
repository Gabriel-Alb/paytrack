import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const userCompanies = (...args) => repository('companies').userCompanies(...args);
export const replaceUserCompanies = (...args) => repository('companies').replaceUserCompanies(...args);
export const listCompanies = (...args) => repository('companies').listCompanies(...args);
export const createCompany = (...args) => repository('companies').createCompany(...args);
export const companyExists = (...args) => repository('companies').companyExists(...args);
export const updateCompany = (...args) => repository('companies').updateCompany(...args);
export const publicCompanies = (...args) => repository('companies').publicCompanies(...args);
export const membership = (...args) => repository('companies').membership(...args);
export const setMembership = (...args) => repository('companies').setMembership(...args);
export const removeMembership = (...args) => repository('companies').removeMembership(...args);
export const activeManagers = (...args) => repository('companies').activeManagers(...args);
export const companyUsers = (...args) => repository('companies').companyUsers(...args);
export const companyUsersCount = (...args) => repository('companies').companyUsersCount(...args);
export const requestCompanies = (...args) => repository('companies').requestCompanies(...args);
export const addRequestedCompany = (...args) => repository('companies').addRequestedCompany(...args);
export const decideRequestedCompany = (...args) => repository('companies').decideRequestedCompany(...args);
export const syncRequestAccount = (...args) => repository('companies').syncRequestAccount(...args);
