import { database } from "../../config/database.js";
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

export function previewPayment(id, data) {
  const installment = requireRecord(findInstallment(id), "Parcela");
  validatePaymentDate(data.payment_date, installment.loan_date);
  const lateDays = daysLate(installment.due_date, data.payment_date);
  return {
    days_late: lateDays,
    late_fee_amount: lateDays * installment.late_fee_per_day,
  };
}

export function registerPayment(id, data) {
  return database()
    .transaction(() => {
      const installment = requireRecord(findInstallment(id), "Parcela");
      const loan = getLoan(installment.loan_id);
      assertRevision(loan, data.revision);
      assertPayable(loan);
      validatePaymentDate(data.payment_date, loan.loan_date);
      const current = loan.installments.find((item) => item.id === id);
      if (data.amount > current.amount - current.paid_amount)
        conflict(
          "PAYMENT_EXCEEDS_BALANCE",
          "O pagamento excede o saldo da parcela.",
        );
      const paymentId = repository.insertPayment({
        ...data,
        installment_id: id,
      });
      refreshFinancialState(loan.id);
      bumpRevision(loan.id);
      return {
        payment: repository.findPayment(paymentId),
        loan: getLoan(loan.id),
      };
    })
    .immediate();
}

function reconcileSelection(loan, installment, selection) {
  if (!selection) {
    if (installment.status === "paid")
      repository.voidInstallmentPayments(installment.id);
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
  const previousDate = repository.lastPaymentDate(installment.id);
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
  if (corrected) repository.voidInstallmentPayments(installment.id);
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
    repository.insertPayment({
      installment_id: installment.id,
      amount,
      late_fee_amount: feeAmount,
      payment_date: amount > 0 ? selection.payment_date : today(),
      notes: corrected ? "Correção de pagamento pelo modal do contrato" : null,
    });
  }
}

export function confirmPayments(id, data) {
  return database()
    .transaction(() => {
      const loan = getLoan(id);
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
        reconcileSelection(
          loan,
          installment,
          selections.get(installment.installment_number),
        );
      refreshFinancialState(id);
      bumpRevision(id);
      return getLoan(id);
    })
    .immediate();
}
