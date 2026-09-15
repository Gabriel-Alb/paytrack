import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const findLoan = (...args) => repository('loans').findLoan(...args);
export const loansDueInPeriod = (...args) => repository('loans').loansDueInPeriod(...args);
export const listLoans = (...args) => repository('loans').listLoans(...args);
export const insertLoan = (...args) => repository('loans').insertLoan(...args);
export const updateLoan = (...args) => repository('loans').updateLoan(...args);
export const bumpRevision = (...args) => repository('loans').bumpRevision(...args);
export const hasReceipts = (...args) => repository('loans').hasReceipts(...args);
