import { database } from "../../config/database.js";
import { env } from "../../config/env.js";
import { today, addDays, visualStatus } from "../../shared/utils/dates.js";
import { interestAmount } from "../../shared/utils/money.js";
import {
  AppError,
  requireRecord,
  conflict,
} from "../../shared/errors/AppError.js";
import { pagination } from "../../shared/utils/validation.js";
import { findClient } from "../clients/clients.repository.js";
import * as repository from "./loans.repository.js";
import * as installments from "../installments/installments.repository.js";
import {
  refreshFinancialState,
  refreshClient,
} from "../installments/installments.service.js";
import { listPayments } from "../payments/payments.repository.js";
import { recordAction } from '../auth/auth.repository.js';

function auditLoan(event, actor, loan) {
  recordAction(event,actor,'loan',loan.id,{
    customer:loan.client_name,amount:loan.principal_amount,loanId:loan.id,
    installment_count:loan.installment_count,loan_date:loan.loan_date,
    end_date:loan.installments.at(-1)?.due_date,
  });
}

function presentLoan(loan) {
  return {
    ...loan,
    display_status: ["paid", "cancelled"].includes(loan.status)
      ? loan.status
      : visualStatus(loan.days_late, loan.fee_remaining > 0),
  };
}

export function getLoan(id) {
  refreshFinancialState();
  const loan = requireRecord(repository.findLoan(id, today()), "Empréstimo");
  return {
    ...presentLoan(loan),
    installments: installments.listInstallments(id),
    payments: listPayments(id),
  };
}

export function listLoans(query) {
  refreshFinancialState();
  const result = repository.listLoans(
    pagination(query),
    today(),
    env.ATTENTION_DAYS,
  );
  return {
    ...result,
    items: result.items.map(presentLoan),
    page: query.page,
    limit: query.limit,
  };
}

export function distributeInstallments(total, count, overrides = {}) {
  const values = Array(count).fill(null);
  let remaining = total;
  for (const [key, value] of Object.entries(overrides)) {
    const index = Number(key);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= count ||
      values[index] !== null
    ) {
      throw new AppError(
        400,
        "INVALID_INSTALLMENT",
        "Índice de parcela personalizada inválido.",
      );
    }
    values[index] = value;
    remaining -= value;
  }
  const automatic = values.filter((value) => value === null).length;
  if (remaining < automatic || (!automatic && remaining !== 0)) {
    throw new AppError(
      400,
      "INSTALLMENT_TOTAL_MISMATCH",
      "Os valores personalizados devem preservar o total e parcelas positivas.",
    );
  }
  let remainder = automatic ? remaining % automatic : 0;
  return values.map(
    (value) =>
      value ?? Math.floor(remaining / automatic) + (remainder-- > 0 ? 1 : 0),
  );
}

function validateAmounts(values, count, total) {
  if (
    values.length !== count ||
    values.reduce((sum, value) => sum + value, 0) !== total
  ) {
    throw new AppError(
      400,
      "INSTALLMENT_TOTAL_MISMATCH",
      "A soma das parcelas deve corresponder exatamente ao total do empréstimo.",
    );
  }
}

export function assertRevision(loan, revision) {
  if (loan.revision !== revision)
    conflict(
      "STALE_LOAN",
      "Este contrato foi alterado. Reabra-o antes de salvar novamente.",
    );
}

export function createLoan(data, actor) {
  return database()
    .transaction(() => {
      requireRecord(findClient(data.client_id), "Cliente");
      const interest = interestAmount(
        data.principal_amount,
        data.interest_percentage,
      );
      const total = data.principal_amount + interest;
      if (total > 100000000000)
        throw new AppError(
          400,
          "AMOUNT_LIMIT",
          "Total do contrato excede o limite permitido.",
        );
      const values =
        data.installments ??
        distributeInstallments(
          total,
          data.installment_count,
          data.installment_overrides,
        );
      validateAmounts(values, data.installment_count, total);
      if (data.installments && data.installment_overrides) {
        for (const [index, amount] of Object.entries(
          data.installment_overrides,
        )) {
          if (values[Number(index)] !== amount)
            throw new AppError(
              400,
              "INVALID_OVERRIDE",
              "Valor personalizado diverge da parcela enviada.",
            );
        }
      }
      const id = repository.insertLoan({
        ...data,
        interest_amount: interest,
        total_amount: total,
        notes: data.notes ?? null,
      },actor?.id);
      values.forEach((amount, index) =>
        installments.insertInstallment({
          loan_id: id,
          installment_number: index + 1,
          amount,
          due_date: addDays(data.first_due_date, index),
        }),
      );
      refreshFinancialState(id);
      const result = getLoan(id);
      auditLoan('loan_created',actor,result);
      return result;
    })
    .immediate();
}

export function updateLoan(id, data, actor) {
  return database()
    .transaction(() => {
      const loan = getLoan(id);
      assertRevision(loan, data.revision);
      if (data.status === "cancelled" && repository.hasReceipts(id)) {
        conflict(
          "LOAN_HAS_PAYMENTS",
          "Não é possível cancelar um contrato com histórico de pagamentos.",
        );
      }
      repository.updateLoan(
        id,
        data.notes === undefined ? loan.notes : data.notes,
        data.status ?? loan.status,
      );
      refreshClient(loan.client_id);
      const result = getLoan(id);
      auditLoan(data.status==='cancelled' ? 'loan_cancelled' : 'loan_updated',actor,result);
      return result;
    })
    .immediate();
}

export function updateInstallments(id, data, actor) {
  return database()
    .transaction(() => {
      const loan = getLoan(id);
      assertRevision(loan, data.revision);
      if (loan.status === "cancelled" || repository.hasReceipts(id))
        conflict(
          "INSTALLMENTS_LOCKED",
          "As parcelas só podem ser reajustadas antes de registrar pagamentos.",
        );
      validateAmounts(
        data.installments,
        loan.installment_count,
        loan.total_amount,
      );
      installments.updateAmounts(
        loan.installments.map((item, index) => ({
          id: item.id,
          amount: data.installments[index],
        })),
      );
      repository.bumpRevision(id);
      refreshFinancialState(id);
      const result = getLoan(id);
      auditLoan('installments_updated',actor,result);
      return result;
    })
    .immediate();
}
