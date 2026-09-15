import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const findInstallment = (...args) => repository('installments').findInstallment(...args);
export const listInstallments = (...args) => repository('installments').listInstallments(...args);
export const insertInstallment = (...args) => repository('installments').insertInstallment(...args);
export const updateAmounts = (...args) => repository('installments').updateAmounts(...args);
export const reconcileInstallments = (...args) => repository('installments').reconcileInstallments(...args);
export const reconcileFees = (...args) => repository('installments').reconcileFees(...args);
export const loanBalances = (...args) => repository('installments').loanBalances(...args);
export const saveLoanStatus = (...args) => repository('installments').saveLoanStatus(...args);
export const clientBalances = (...args) => repository('installments').clientBalances(...args);
export const saveClientStatus = (...args) => repository('installments').saveClientStatus(...args);
