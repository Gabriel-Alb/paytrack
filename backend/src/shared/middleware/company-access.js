import { userCompanies } from '../../modules/companies/companies.repository.js';
import { withCompanyAccess } from '../../application/company-access.js';
export { withCompanyAccess } from '../../application/company-access.js';
export async function companyAccess(req, _res, next) {
  const companyIds = req.user ? (await userCompanies(req.user.id)).map(row => row.id) : [];
  withCompanyAccess({ role: req.user?.role, companyIds }, next);
}
