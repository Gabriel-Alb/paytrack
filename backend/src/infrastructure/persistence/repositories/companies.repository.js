import { database } from '../connection.js';
import { AppError } from '../../../shared/errors/AppError.js';

export const userCompanies = async id => (await database().prepare(`SELECT c.id,c.name FROM companies c
  JOIN user_companies uc ON uc.company_id=c.id WHERE uc.user_id=? ORDER BY c.name`).all(id));

export async function replaceUserCompanies(id, companyIds) {
  const db = database();
  for (const companyId of companyIds) {
    if (!(await db.prepare('SELECT 1 FROM companies WHERE id=?').get(companyId)))
      throw new AppError(400,'INVALID_COMPANY','Uma das empresas selecionadas não existe.');
  }
  (await db.prepare('DELETE FROM user_companies WHERE user_id=?').run(id));
  const insert = db.prepare('INSERT INTO user_companies(user_id,company_id) VALUES(?,?)');
  for (const companyId of companyIds) (await insert.run(id,companyId));
}

export const listCompanies = async () => (await database().prepare('SELECT id,name FROM companies WHERE can_access_company(id) ORDER BY name').all());
export async function createCompany(name) {
  try {
    const id = Number((await database().prepare('INSERT INTO companies(name) VALUES(?)').run(name)).lastInsertRowid);
    return {id,name};
  } catch (error) {
    if (error.code === 'PERSISTENCE_UNIQUE') throw new AppError(409,'COMPANY_EXISTS','Já existe uma empresa com este nome.');
    throw error;
  }
}

export const companyExists = async id => (await database().prepare('SELECT 1 FROM companies WHERE id=?').get(id));
