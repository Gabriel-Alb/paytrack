import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Verifique os dados informados.",
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
  if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
    const document = ["cpf", "rg", "cnh"].find((key) =>
      error.message.includes(`clients.${key}`),
    );
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
  if (error.code?.startsWith("SQLITE_CONSTRAINT")) {
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
  // Never log error objects: SQLite/validation errors can contain input or secrets.
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
