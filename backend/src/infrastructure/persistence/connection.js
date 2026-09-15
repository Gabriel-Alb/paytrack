let connection;
export const setConnection = value => { connection = value; };
export function database() {
  if (!connection) throw new Error('Persistência não inicializada.');
  return connection;
}
