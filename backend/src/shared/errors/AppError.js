export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function requireRecord(record, name) {
  if (!record) throw new AppError(404, "NOT_FOUND", `${name} não encontrado.`);
  return record;
}

export function conflict(code, message) {
  throw new AppError(409, code, message);
}
