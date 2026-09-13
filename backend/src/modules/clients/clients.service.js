import { database } from "../../config/database.js";
import * as repository from "./clients.repository.js";
import { requireRecord, conflict } from "../../shared/errors/AppError.js";
import {
  refreshFinancialState,
  refreshClient,
} from "../installments/installments.service.js";
import { pagination } from "../../shared/utils/validation.js";
import { recordAction } from '../auth/auth.repository.js';

import { resolveCompany } from '../../shared/middleware/company-access.js';

function checkDocuments(data, id) {
  const duplicates = repository.findDuplicate(data, id);
  for (const key of ["cpf", "rg", "cnh"]) {
    if (data[key] && duplicates.some((row) => row[key] === data[key])) {
      conflict(
        `CLIENT_${key.toUpperCase()}_ALREADY_EXISTS`,
        `Já existe um cliente cadastrado com este ${key.toUpperCase()}.`,
      );
    }
  }
}

export function getClient(id) {
  refreshFinancialState();
  return {
    ...requireRecord(repository.findClient(id), "Cliente"),
    loans: repository.clientHistory(id),
  };
}

export function listClients(query) {
  refreshFinancialState();
  return {
    ...repository.listClients(pagination(query)),
    page: query.page,
    limit: query.limit,
  };
}

export function createClient(data, actor) {
  return database()
    .transaction(() => {
      const client = {
        rg: null,
        cnh: null,
        phone: null,
        email: null,
        notes: null,
        ...data,
      };
      client.company_id = resolveCompany(data.company_id);
      checkDocuments(client);
      const id = repository.insertClient(client,actor?.id);
      recordAction('client_created',actor,'client',id,{customer:client.name});
      return getClient(id);
    })
    .immediate();
}

export function updateClient(id, data, actor) {
  return database()
    .transaction(() => {
      const client = {
        ...requireRecord(repository.findClient(id), "Cliente"),
        ...data,
      };
      checkDocuments(client, id);
      if (data.status !== undefined)
        client.status_override =
          data.status === "negativado" ? "negativado" : null;
      repository.updateClient(client);
      refreshFinancialState();
      refreshClient(id);
      const result = getClient(id);
      if (data.status && result.status !== data.status) {
        conflict(
          "CLIENT_STATUS_CONFLICT",
          "O status escolhido não corresponde aos contratos e pendências deste cliente.",
        );
      }
      recordAction('client_updated',actor,'client',id,{customer:result.name,fields:Object.keys(data)});
      return result;
    })
    .immediate();
}
