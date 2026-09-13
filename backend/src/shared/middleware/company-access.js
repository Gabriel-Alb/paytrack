import { AsyncLocalStorage } from 'node:async_hooks';
import { database } from '../../config/database.js';
import { AppError } from '../errors/AppError.js';

// Per-request state, never a global mutable "current company". Sessions resolve
// the role from the database on every request; memberships are loaded here.
const context = new AsyncLocalStorage();
export const withCompanyAccess = (access, operation) => context.run(access, operation);
export function companyAccess(req, _res, next) {
  const companyIds = req.user ? database().prepare('SELECT company_id FROM user_companies WHERE user_id=?').all(req.user.id).map(row => row.company_id) : [];
  context.run({ role: req.user?.role, companyIds }, next);
}
export function canAccessCompany(id) {
  const access = context.getStore();
  // Only offline CLI/seed operations run outside the HTTP context.
  return Number(!access || access.role === 'admin' || access.companyIds.includes(id));
}
export function resolveCompany(id) {
  const access = context.getStore();
  if (id === undefined) {
    if (!access) id = 1;
    else if (access.role === 'user' && access.companyIds.length === 1) id = access.companyIds[0];
    else throw new AppError(400, 'COMPANY_REQUIRED', 'Selecione a empresa responsável.');
  }
  if (!canAccessCompany(id) || !database().prepare('SELECT 1 FROM companies WHERE id=?').get(id))
    throw new AppError(403, 'COMPANY_FORBIDDEN', 'Empresa não disponível para este acesso.');
  return id;
}

export function installCompanyAccess(db) {
  db.function('can_access_company', canAccessCompany);
  db.exec(`CREATE TEMP VIEW scoped_clients AS SELECT * FROM main.clients WHERE can_access_company(company_id);
    CREATE TEMP VIEW scoped_loans AS SELECT l.*,c.company_id FROM main.loans l JOIN scoped_clients c ON c.id=l.client_id;
    CREATE TEMP VIEW scoped_installments AS SELECT i.* FROM main.installments i JOIN scoped_loans l ON l.id=i.loan_id;
    CREATE TEMP VIEW scoped_payments AS SELECT p.* FROM main.payments p JOIN scoped_installments i ON i.id=p.installment_id;
    CREATE TEMP VIEW scoped_late_fees AS SELECT f.* FROM main.late_fees f JOIN scoped_installments i ON i.id=f.installment_id;
    CREATE TEMP VIEW scoped_auth_audit_logs AS SELECT a.* FROM main.auth_audit_logs a WHERE
      (a.entity_type='client' AND a.entity_id IN (SELECT id FROM scoped_clients)) OR
      (a.entity_type='loan' AND a.entity_id IN (SELECT id FROM scoped_loans)) OR
      (a.entity_type='payment' AND a.entity_id IN (SELECT id FROM scoped_payments));`);
  // Defense in depth for all writes, including reconciliation and future services.
  const owners = {
    clients: row => `can_access_company(${row}.company_id)`,
    loans: row => `EXISTS(SELECT 1 FROM scoped_clients WHERE id=${row}.client_id)`,
    installments: row => `EXISTS(SELECT 1 FROM scoped_loans WHERE id=${row}.loan_id)`,
    payments: row => `EXISTS(SELECT 1 FROM scoped_installments WHERE id=${row}.installment_id)`,
    late_fees: row => `EXISTS(SELECT 1 FROM scoped_installments WHERE id=${row}.installment_id)`,
  };
  for (const [table, allowed] of Object.entries(owners)) {
    for (const operation of ['INSERT','UPDATE','DELETE']) {
      const checks = operation === 'INSERT' ? allowed('NEW') : operation === 'DELETE' ? allowed('OLD') : `(${allowed('NEW')} AND ${allowed('OLD')})`;
      db.exec(`CREATE TEMP TRIGGER guard_${table}_${operation} BEFORE ${operation} ON main.${table}
        WHEN NOT (${checks}) BEGIN SELECT RAISE(ABORT,'Company access denied'); END;`);
    }
  }
}
