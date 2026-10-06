import { unitOfWork } from '../../application/persistence.js';
import { env } from "../../config/env.js";
import { today, addDays, daysLate, visualStatus } from "../../shared/utils/dates.js";
import { interestAmount } from "../../shared/utils/money.js";
import {
  AppError,
  requireRecord,
  conflict,
} from "../../shared/errors/AppError.js";
import { pagination } from "../../shared/utils/validation.js";
import { findClient, clientHasCompany } from "../clients/clients.repository.js";
import * as repository from "./loans.repository.js";
import * as installments from "../installments/installments.repository.js";
import {
  refreshFinancialState,
  refreshClient,
} from "../installments/installments.service.js";
import { listPayments } from "../payments/payments.repository.js";
import { validatePaymentDate } from '../payments/payments.service.js';
import { recordAction } from '../auth/auth.repository.js';

import { loanSchema } from './loans.validator.js';

import { resolveCompany, companyAccessContext } from '../../application/company-access.js';

async function auditLoan(event, actor, loan) {
  (await recordAction(event,actor,'loan',loan.id,{
    customer:loan.client_name,amount:loan.principal_amount,loanId:loan.id,
    installment_count:loan.installment_count,loan_date:loan.loan_date,
    end_date:loan.installments.at(-1)?.due_date,
  }));
}

function presentLoan(loan) {
  return {
    ...loan,
    display_status: ["paid", "cancelled"].includes(loan.status)
      ? loan.status
      : visualStatus(loan.days_late, loan.fee_remaining > 0),
  };
}

export async function getLoan(id) {
  (await refreshFinancialState());
  const loan = requireRecord((await repository.findLoan(id, today())), "Empréstimo");
  return {
    ...presentLoan(loan),
    installments: (await installments.listInstallments(id)),
    payments: (await listPayments(id)),
  };
}

export async function listLoans(query) {
  (await refreshFinancialState());
  const result = (await repository.listLoans(
    pagination(query),
    today(),
    env.ATTENTION_DAYS,
  ));
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

function calculateContract(data) {
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
  return { interest, total, values };
}

export async function createLoan(data, actor) {
  return (await unitOfWork(async () => {
      const companyId = (await resolveCompany(data.company_id));
      requireRecord((await findClient(data.client_id)), "Cliente");
      if (!await clientHasCompany(data.client_id, companyId))
        conflict('CLIENT_COMPANY_MISMATCH', 'O cliente não está vinculado à empresa do empréstimo.');
      const { interest, total, values } = calculateContract(data);
      const id = (await repository.insertLoan({
        ...data,
        company_id: companyId,
        interest_amount: interest,
        total_amount: total,
        notes: data.notes ?? null,
      },actor?.id));
      for (const [index, amount] of values.entries())
        (await installments.insertInstallment({
          loan_id: id,
          installment_number: index + 1,
          amount,
          due_date: addDays(data.first_due_date, index),
        }));
      (await refreshFinancialState(id));
      const result = (await getLoan(id));
      (await auditLoan('loan_created',actor,result));
      return result;
    }));
}

export async function updateLoan(id, data, actor) {
  return (await unitOfWork(async () => {
      const loan = (await getLoan(id));
      assertRevision(loan, data.revision);
      if (data.status === "cancelled" && (await repository.hasReceipts(id))) {
        conflict(
          "LOAN_HAS_PAYMENTS",
          "Não é possível cancelar um contrato com histórico de pagamentos.",
        );
      }
      if (data.company_id !== undefined) {
        await resolveCompany(data.company_id);
        if (data.company_id !== loan.company_id && companyAccessContext()?.role !== 'admin')
          conflict('LOAN_COMPANY_IMMUTABLE', 'Somente administradores podem alterar a empresa do contrato.');
      }
      const fields = ['client_id', 'principal_amount', 'interest_percentage', 'installment_count',
        'late_fee_per_day', 'loan_date', 'first_due_date', 'notes'];
      const merged = Object.fromEntries(fields.map(key => [key, data[key] === undefined ? loan[key] : data[key]]));
      const totalsChanged = ['principal_amount', 'interest_percentage', 'installment_count']
        .some(key => Number(merged[key]) !== Number(loan[key]));
      const contract = loanSchema.parse({ ...merged, company_id:data.company_id ?? loan.company_id,
        ...(data.installments ? { installments:data.installments } :
          !totalsChanged && !data.installment_overrides ? { installments:loan.installments.map(item => item.amount) } : {}),
        ...(data.installment_overrides ? { installment_overrides:data.installment_overrides } : {}),
      });
      requireRecord(await findClient(contract.client_id), 'Cliente');
      if (!await clientHasCompany(contract.client_id, contract.company_id))
        conflict('CLIENT_COMPANY_MISMATCH', 'O cliente não está vinculado à empresa do empréstimo.');
      const { interest, total, values } = calculateContract(contract);
      const financialChanged = totalsChanged ||
        ['late_fee_per_day', 'loan_date', 'first_due_date'].some(key => contract[key] !== loan[key]) ||
        values.some((amount, index) => amount !== loan.installments[index]?.amount);
      if (financialChanged) assertCompatiblePayments(loan, contract, values);
      await repository.updateLoan(id, { ...contract, interest_amount:interest, total_amount:total,
        notes:contract.notes ?? null, status:data.status ?? loan.status });
      if (financialChanged) {
        await installments.updateSchedule(id, values.map((amount, index) => ({
          installment_number:index + 1, amount, due_date:addDays(contract.first_due_date, index),
        })));
      }
      await refreshFinancialState(id);
      await refreshClient(loan.client_id);
      if (contract.client_id !== loan.client_id) await refreshClient(contract.client_id);
      const result = (await getLoan(id));
      (await auditLoan(data.status==='cancelled' ? 'loan_cancelled' : 'loan_updated',actor,result));
      return result;
    }));
}

function assertCompatiblePayments(loan, contract, values) {
  for (const installment of loan.installments) {
    const index = installment.installment_number - 1;
    const history = loan.payments.filter(payment => payment.installment_id === installment.id);
    if (values[index] === undefined) {
      if (history.length) conflict('INSTALLMENT_HAS_PAYMENTS', 'Não é possível remover uma parcela com histórico de pagamentos.');
      continue;
    }
    if (values[index] < installment.paid_amount)
      conflict('PAYMENT_EXCEEDS_BALANCE', 'O valor da parcela não pode ser inferior ao valor já recebido.');
    const active = history.filter(payment => !payment.voided_at);
    for (const payment of active) validatePaymentDate(payment.payment_date, contract.loan_date);
    const paidAt = values[index] === installment.paid_amount
      ? active.filter(payment => payment.amount > 0).map(payment => payment.payment_date).sort().at(-1)
      : null;
    let receivedFee = 0;
    for (const payment of active.sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.id - b.id)) {
      receivedFee += payment.late_fee_amount;
      const date = paidAt && paidAt < payment.payment_date ? paidAt : payment.payment_date;
      const fee = daysLate(addDays(contract.first_due_date, index), date) * contract.late_fee_per_day;
      if (receivedFee > fee)
        conflict('FEE_PAYMENT_EXCEEDS_BALANCE', 'As condições não podem reduzir a multa abaixo do valor recebido na data do pagamento.');
    }
  }
}

export async function updateInstallments(id, data, actor) {
  return (await unitOfWork(async () => {
      const loan = (await getLoan(id));
      assertRevision(loan, data.revision);
      if (loan.status === "cancelled" || (await repository.hasReceipts(id)))
        conflict(
          "INSTALLMENTS_LOCKED",
          "As parcelas só podem ser reajustadas antes de registrar pagamentos.",
        );
      validateAmounts(
        data.installments,
        loan.installment_count,
        loan.total_amount,
      );
      (await installments.updateAmounts(
        loan.installments.map((item, index) => ({
          id: item.id,
          amount: data.installments[index],
        })),
      ));
      (await repository.bumpRevision(id));
      (await refreshFinancialState(id));
      const result = (await getLoan(id));
      (await auditLoan('installments_updated',actor,result));
      return result;
    }));
}
