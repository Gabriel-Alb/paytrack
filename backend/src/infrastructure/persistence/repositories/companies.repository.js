import { database } from '../connection.js';
import { AppError } from '../../../shared/errors/AppError.js';

export const userCompanies = async id => (await database().prepare(`SELECT c.id,c.name,uc.role FROM companies c
  JOIN user_companies uc ON uc.company_id=c.id WHERE uc.user_id=? ORDER BY c.name`).all(id));

export async function replaceUserCompanies(id, companyIds) {
  const db = database();
  for (const companyId of companyIds) {
    if (!(await db.prepare('SELECT 1 FROM companies WHERE id=?').get(companyId)))
      throw new AppError(400,'INVALID_COMPANY','Uma das empresas selecionadas não existe.');
  }
  for (const company of await userCompanies(id)) {
    if (!companyIds.includes(company.id)) await removeMembership(id,company.id);
  }
  const insert = db.prepare('INSERT INTO user_companies(user_id,company_id) VALUES(?,?) ON CONFLICT(user_id,company_id) DO NOTHING');
  for (const companyId of companyIds) (await insert.run(id,companyId));
}

export const publicCompanies = () => database().prepare('SELECT id,name FROM companies ORDER BY name').all();
export const membership = (userId,companyId) => database().prepare('SELECT role FROM user_companies WHERE user_id=? AND company_id=?').get(userId,companyId);
export const setMembership = (userId,companyId,role) => database().prepare(`INSERT INTO user_companies(user_id,company_id,role) VALUES(?,?,?)
  ON CONFLICT(user_id,company_id) DO UPDATE SET role=excluded.role`).run(userId,companyId,role);
export const removeMembership = (userId,companyId) => database().prepare('DELETE FROM user_companies WHERE user_id=? AND company_id=?').run(userId,companyId);
export const activeManagers = companyId => database().prepare(`SELECT count(*) n FROM user_companies uc JOIN users u ON u.id=uc.user_id
  WHERE uc.company_id=? AND uc.role='MANAGER' AND u.access_status='active'`).get(companyId);
export const companyUsers = (companyId,page) => database().prepare(`SELECT u.id,u.name,u.email,u.access_status AS "accessStatus",uc.role AS "companyRole"
  FROM users u JOIN user_companies uc ON uc.user_id=u.id WHERE uc.company_id=? ORDER BY u.name,u.id LIMIT 50 OFFSET ?`).all(companyId,(page-1)*50);
export const companyUsersCount = companyId => database().prepare('SELECT count(*) n FROM user_companies WHERE company_id=?').get(companyId);
export const requestCompanies = userId => database().prepare(`SELECT c.id,c.name,r.status,r.company_role AS "companyRole",
  r.decided_by AS "decidedBy",r.decided_at AS "decidedAt" FROM user_access_companies r
  JOIN companies c ON c.id=r.company_id WHERE r.user_id=? ORDER BY c.name`).all(userId);
export const addRequestedCompany = (userId,companyId) => database().prepare('INSERT INTO user_access_companies(user_id,company_id) VALUES(?,?)').run(userId,companyId);
export const decideRequestedCompany = (userId,companyId,status,role,actorId) => database().prepare(`UPDATE user_access_companies
  SET status=?,company_role=?,decided_by=?,decided_at=utc_now() WHERE user_id=? AND company_id=? AND status='pending'`).run(status,role,actorId,userId,companyId);
export const syncRequestAccount = (userId,actorId) => database().prepare(`UPDATE users SET
  access_status=CASE WHEN EXISTS(SELECT 1 FROM user_access_companies WHERE user_id=@id AND status='approved') THEN 'active'
    WHEN EXISTS(SELECT 1 FROM user_access_companies WHERE user_id=@id AND status='pending') THEN 'pending' ELSE 'rejected' END,
  approved_by=CASE WHEN EXISTS(SELECT 1 FROM user_access_companies WHERE user_id=@id AND status='approved') THEN COALESCE(approved_by,@actorId) ELSE approved_by END,
  approved_at=CASE WHEN EXISTS(SELECT 1 FROM user_access_companies WHERE user_id=@id AND status='approved') THEN COALESCE(approved_at,utc_now()) ELSE approved_at END,
  rejected_at=CASE WHEN NOT EXISTS(SELECT 1 FROM user_access_companies WHERE user_id=@id AND status<>'rejected') THEN utc_now() ELSE rejected_at END,
  updated_at=utc_now() WHERE id=@id AND access_status IN ('pending','rejected','active')`).run({id:userId,actorId});

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

export async function updateCompany(id, name) {
  try {
    const result = await database().prepare('UPDATE companies SET name=? WHERE id=? AND can_access_company(id)').run(name, id);
    if (!result.changes) throw new AppError(404, 'NOT_FOUND', 'Empresa não encontrada.');
    return { id, name };
  } catch (error) {
    if (error.code === 'PERSISTENCE_UNIQUE') throw new AppError(409, 'COMPANY_EXISTS', 'Já existe uma empresa com este nome.');
    throw error;
  }
}
