import { database } from '../../config/database.js';
import { AppError } from '../../shared/errors/AppError.js';

export const userCompanies = id => database().prepare(`SELECT c.id,c.name FROM companies c
  JOIN user_companies uc ON uc.company_id=c.id WHERE uc.user_id=? ORDER BY c.name`).all(id);

export function replaceUserCompanies(id, companyIds) {
  const db = database();
  for (const companyId of companyIds) {
    if (!db.prepare('SELECT 1 FROM companies WHERE id=?').get(companyId))
      throw new AppError(400,'INVALID_COMPANY','Uma das empresas selecionadas não existe.');
  }
  db.prepare('DELETE FROM user_companies WHERE user_id=?').run(id);
  const insert = db.prepare('INSERT INTO user_companies(user_id,company_id) VALUES(?,?)');
  for (const companyId of companyIds) insert.run(id,companyId);
}

export const listCompanies = () => database().prepare('SELECT id,name FROM companies WHERE can_access_company(id) ORDER BY name').all();
export function createCompany(name) {
  try {
    const id = Number(database().prepare('INSERT INTO companies(name) VALUES(?)').run(name).lastInsertRowid);
    return {id,name};
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new AppError(409,'COMPANY_EXISTS','Já existe uma empresa com este nome.');
    throw error;
  }
}
