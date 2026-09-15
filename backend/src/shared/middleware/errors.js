import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: _req.originalUrl?.split('?')[0] === '/api/auth/request-access'
          ? [...new Set(error.issues.map(({ path }) => ({
            name: 'Informe um nome entre 2 e 150 caracteres.',
            email: 'Informe um e-mail válido.',
            cpf: 'Informe um CPF válido.',
            rg: 'Confira o RG informado (até 30 caracteres).',
            cnh: 'A CNH deve conter 11 dígitos ou ficar em branco.',
            password: 'A senha deve conter de 6 a 20 caracteres.',
          })[path[0]] || 'Verifique os dados informados.'))].join(' ')
          : "Verifique os dados informados.",
        details: _req.path.includes('/auth/') ? undefined : error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        })),
      },
    });
  }
  if (error instanceof AppError) {
    return res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
  }
  if (error.code === "PERSISTENCE_UNIQUE") {
    const document = error.document;
    return res.status(409).json({
      error: {
        code: document
          ? `CLIENT_${document.toUpperCase()}_ALREADY_EXISTS`
          : "DUPLICATE_RECORD",
        message: document
          ? `Já existe um cliente cadastrado com este ${document.toUpperCase()}.`
          : "Registro já cadastrado.",
      },
    });
  }
  if (error.code === "PERSISTENCE_CONSTRAINT") {
    return res
      .status(409)
      .json({
        error: {
          code: "DATA_CONFLICT",
          message: "A operação conflita com os dados existentes.",
        },
      });
  }
  if (
    error.type === "entity.parse.failed" ||
    error.type === "entity.too.large"
  ) {
    return res
      .status(400)
      .json({
        error: {
          code: "INVALID_JSON",
          message: "Corpo JSON inválido ou muito grande.",
        },
      });
  }
  // Never log error objects: persistence/validation errors can contain secrets.
  console.error("Falha interna na API.");
  return res
    .status(500)
    .json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir a operação.",
      },
    });
}
