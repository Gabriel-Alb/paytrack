// Application ports. Only the composition root supplies implementations.
// Repository methods return Promises; unitOfWork keeps nested operations atomic.
let persistence;
export function configurePersistence(implementation) { persistence = implementation; }
export function repository(name) {
  if (!persistence) throw new Error('Persistência não inicializada.');
  return persistence[name];
}
export function unitOfWork(operation, options) {
  return repository('unitOfWork')(operation, options);
}
