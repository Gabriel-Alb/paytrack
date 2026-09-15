import { unitOfWork } from '../../application/persistence.js';
import * as repository from "./clients.repository.js";
import { requireRecord, conflict } from "../../shared/errors/AppError.js";
import {
  refreshFinancialState,
  refreshClient,
} from "../installments/installments.service.js";
import { pagination } from "../../shared/utils/validation.js";
import { recordAction } from '../auth/auth.repository.js';

import { resolveCompany } from '../../application/company-access.js';

async function checkDocuments(data, id) {
  const duplicates = (await repository.findDuplicate(data, id));
  for (const key of ["cpf", "rg", "cnh"]) {
    if (data[key] && duplicates.some((row) => row[key] === data[key])) {
      conflict(
        `CLIENT_${key.toUpperCase()}_ALREADY_EXISTS`,
        `Já existe um cliente cadastrado com este ${key.toUpperCase()}.`,
      );
    }
  }
}

export async function getClient(id) {
  (await refreshFinancialState());
  return {
    ...requireRecord((await repository.findClient(id)), "Cliente"),
    loans: (await repository.clientHistory(id)),
  };
}

export async function listClients(query) {
  (await refreshFinancialState());
  return {
    ...(await repository.listClients(pagination(query))),
    page: query.page,
    limit: query.limit,
  };
}

export async function createClient(data, actor) {
  return (await unitOfWork(async () => {
      const client = {
        rg: null,
        cnh: null,
        phone: null,
        email: null,
        notes: null,
        ...data,
      };
      client.company_id = (await resolveCompany(data.company_id));
      (await checkDocuments(client));
      const id = (await repository.insertClient(client,actor?.id));
      (await recordAction('client_created',actor,'client',id,{customer:client.name}));
      return (await getClient(id));
    }));
}

export async function updateClient(id, data, actor) {
  return (await unitOfWork(async () => {
      const client = {
        ...requireRecord((await repository.findClient(id)), "Cliente"),
        ...data,
      };
      (await checkDocuments(client, id));
      if (data.status !== undefined)
        client.status_override =
          data.status === "negativado" ? "negativado" : null;
      (await repository.updateClient(client));
      (await refreshFinancialState());
      (await refreshClient(id));
      const result = (await getClient(id));
      if (data.status && result.status !== data.status) {
        conflict(
          "CLIENT_STATUS_CONFLICT",
          "O status escolhido não corresponde aos contratos e pendências deste cliente.",
        );
      }
      (await recordAction('client_updated',actor,'client',id,{customer:result.name,fields:Object.keys(data)}));
      return result;
    }));
}
