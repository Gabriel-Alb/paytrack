import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const findFee = (...args) => repository('late-fees').findFee(...args);
