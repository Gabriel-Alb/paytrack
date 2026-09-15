import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const listPayments = (...args) => repository('payments').listPayments(...args);
export const insertPayment = (...args) => repository('payments').insertPayment(...args);
export const voidInstallmentPayments = (...args) => repository('payments').voidInstallmentPayments(...args);
export const lastPaymentDate = (...args) => repository('payments').lastPaymentDate(...args);
export const findPayment = (...args) => repository('payments').findPayment(...args);
