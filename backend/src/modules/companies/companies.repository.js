import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const userCompanies = (...args) => repository('companies').userCompanies(...args);
export const replaceUserCompanies = (...args) => repository('companies').replaceUserCompanies(...args);
export const listCompanies = (...args) => repository('companies').listCompanies(...args);
export const createCompany = (...args) => repository('companies').createCompany(...args);
export const companyExists = (...args) => repository('companies').companyExists(...args);
