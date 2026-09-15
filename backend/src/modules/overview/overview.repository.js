import { repository } from '../../application/persistence.js';

// Asynchronous repository contract; implementations are supplied at bootstrap.
export const portfolioAt = (...args) => repository('overview').portfolioAt(...args);
export const receipts = (...args) => repository('overview').receipts(...args);
export const receiptDays = (...args) => repository('overview').receiptDays(...args);
export const portfolioStatus = (...args) => repository('overview').portfolioStatus(...args);
export const upcoming = (...args) => repository('overview').upcoming(...args);
export const monthlyReport = (...args) => repository('overview').monthlyReport(...args);
export const report = (...args) => repository('overview').report(...args);
export const notifications = (...args) => repository('overview').notifications(...args);
export const actionNotifications = (...args) => repository('overview').actionNotifications(...args);
