import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const findClient = (...args) => repository('clients').findClient(...args);
export const findDuplicate = (...args) => repository('clients').findDuplicate(...args);
export const listClients = (...args) => repository('clients').listClients(...args);
export const insertClient = (...args) => repository('clients').insertClient(...args);
export const updateClient = (...args) => repository('clients').updateClient(...args);
export const clientHistory = (...args) => repository('clients').clientHistory(...args);
