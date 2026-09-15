export function persistenceError(error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
    const document = ['cpf', 'rg', 'cnh'].find(key =>
      error.message.includes(`clients.${key}`) || error.constraint?.includes(`clients_company_id_${key}`));
    return Object.assign(new Error('Registro já cadastrado.'), { code: 'PERSISTENCE_UNIQUE', document });
  }
  if (error.code?.startsWith('SQLITE_CONSTRAINT') || ['23502','23503','23514','23P01','P0001'].includes(error.code))
    return Object.assign(new Error('Conflito de integridade.'), { code: 'PERSISTENCE_CONSTRAINT' });
  return error;
}
