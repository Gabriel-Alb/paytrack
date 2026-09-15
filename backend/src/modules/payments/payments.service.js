import { unitOfWork } from '../../application/persistence.js';
import { today, daysLate } from "../../shared/utils/dates.js";
import {
  AppError,
  requireRecord,
  conflict,
} from "../../shared/errors/AppError.js";
import { getLoan, assertRevision } from "../loans/loans.service.js";
import { bumpRevision } from "../loans/loans.repository.js";
import { findInstallment } from "../installments/installments.repository.js";
import { refreshFinancialState } from "../installments/installments.service.js";
import * as repository from "./payments.repository.js";

export function validatePaymentDate(date, loanDate) {
  if (date > today() || date < loanDate) {
    throw new AppError(
      400,
      "INVALID_PAYMENT_DATE",
      "A data do pagamento deve estar entre a data do empréstimo e hoje.",
    );
  }
}

export function assertPayable(loan) {
  if (loan.status === "cancelled")
    conflict(
      "LOAN_CANCELLED",
      "Não é possível registrar pagamentos em um contrato cancelado.",
    );
}

export async function previewPayment(id, data) {
  const installment = requireRecord((await findInstallment(id)), "Parcela");
  validatePaymentDate(data.payment_date, installment.loan_date);
  const lateDays = daysLate(installment.due_date, installment.paid_at || data.payment_date);
  return {
    days_late: lateDays,
    late_fee_amount: lateDays * installment.late_fee_per_day,
  };
}

export async function registerPayment(id, data, actor) {
  return (await unitOfWork(async () => {
      const installment = requireRecord((await findInstallment(id)), "Parcela");
      const loan = (await getLoan(installment.loan_id));
      assertRevision(loan, data.revision);
      assertPayable(loan);
      validatePaymentDate(data.payment_date, loan.loan_date);
      const previousDate = (await repository.lastPaymentDate(id));
      if (previousDate && data.payment_date < previousDate)
        conflict("PAYMENT_DATE_CONFLICT", "O pagamento não pode anteceder os recebimentos já registrados.");
      const current = loan.installments.find((item) => item.id === id);
      if (data.amount > current.amount - current.paid_amount)
        conflict(
          "PAYMENT_EXCEEDS_BALANCE",
          "O pagamento excede o saldo da parcela.",
        );
      const paymentId = (await repository.insertPayment({
        ...data,
        installment_id: id,
      },actor));
      (await refreshFinancialState(loan.id));
      (await bumpRevision(loan.id));
      return {
        payment: (await repository.findPayment(paymentId)),
        loan: (await getLoan(loan.id)),
      };
    }));
}

async function reconcileSelection(loan, installment, selection, actor) {
  if (!selection) {
    if (installment.status === "paid")
      (await repository.voidInstallmentPayments(installment.id,actor));
    return;
  }
  validatePaymentDate(selection.payment_date, loan.loan_date);
  const fee =
    daysLate(installment.due_date, selection.payment_date) *
    loan.late_fee_per_day;
  if (selection.late_fee_received_amount > fee)
    conflict(
      "FEE_PAYMENT_EXCEEDS_BALANCE",
      "O valor recebido de multa excede a multa calculada.",
    );
  const previousDate = (await repository.lastPaymentDate(installment.id));
  if (
    installment.status !== "paid" &&
    previousDate &&
    selection.payment_date < previousDate
  ) {
    conflict(
      "PAYMENT_DATE_CONFLICT",
      "A quitação não pode ser anterior aos pagamentos já registrados.",
    );
  }
  const corrected =
    installment.status === "paid" &&
    (installment.paid_at !== selection.payment_date ||
      selection.late_fee_received_amount < installment.late_fee_paid_amount);
  if (corrected) (await repository.voidInstallmentPayments(installment.id,actor));
  const amount = corrected
    ? installment.amount
    : installment.amount - installment.paid_amount;
  const feeAmount =
    selection.late_fee_received_amount -
    (corrected ? 0 : installment.late_fee_paid_amount);
  if (feeAmount < 0)
    conflict(
      "FEE_PAYMENT_CONFLICT",
      "A multa recebida não pode ser reduzida nesta operação.",
    );
  if (amount > 0 || feeAmount > 0) {
    (await repository.insertPayment({
      installment_id: installment.id,
      amount,
      late_fee_amount: feeAmount,
      payment_date: amount > 0 ? selection.payment_date : today(),
      notes: corrected ? "Correção de pagamento pelo modal do contrato" : null,
    },actor,corrected ? 'payment_corrected' : 'payment_created'));
  }
}

export async function confirmPayments(id, data, actor) {
  return (await unitOfWork(async () => {
      const loan = (await getLoan(id));
      assertRevision(loan, data.revision);
      assertPayable(loan);
      if (
        data.payments.some(
          (payment) => payment.installment_number > loan.installment_count,
        )
      ) {
        throw new AppError(
          400,
          "INVALID_INSTALLMENT",
          "Parcela não pertence ao contrato.",
        );
      }
      const selections = new Map(
        data.payments.map((item) => [item.installment_number, item]),
      );
      for (const installment of loan.installments)
        (await reconcileSelection(
          loan,
          installment,
          selections.get(installment.installment_number),
          actor,
        ));
      (await refreshFinancialState(id));
      (await bumpRevision(id));
      return (await getLoan(id));
    }));
}
