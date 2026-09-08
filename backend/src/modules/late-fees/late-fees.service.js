import { database } from "../../config/database.js";
import { requireRecord, conflict } from "../../shared/errors/AppError.js";
import { refreshFinancialState } from "../installments/installments.service.js";
import { findInstallment } from "../installments/installments.repository.js";
import { assertRevision, getLoan } from "../loans/loans.service.js";
import { bumpRevision } from "../loans/loans.repository.js";
import {
  assertPayable,
  validatePaymentDate,
} from "../payments/payments.service.js";
import {
  insertPayment,
  lastPaymentDate,
} from "../payments/payments.repository.js";
import { findFee } from "./late-fees.repository.js";
import { daysLate } from "../../shared/utils/dates.js";

export function getFee(id) {
  refreshFinancialState();
  return requireRecord(findFee(id), "Multa");
}

export function payFee(id, data) {
  return database()
    .transaction(() => {
      const fee = getFee(id);
      const installment = findInstallment(fee.installment_id);
      const loan = getLoan(installment.loan_id);
      assertRevision(loan, data.revision);
      assertPayable(loan);
      validatePaymentDate(data.payment_date, loan.loan_date);
      const availableAtDate =
        daysLate(
          installment.due_date,
          installment.paid_at && installment.paid_at < data.payment_date
            ? installment.paid_at
            : data.payment_date,
        ) * loan.late_fee_per_day;
      const previousDate = lastPaymentDate(installment.id);
      if (previousDate && data.payment_date < previousDate)
        conflict(
          "PAYMENT_DATE_CONFLICT",
          "Pagamento da multa não pode anteceder os recebimentos registrados.",
        );
      if (
        fee.status === "waived" ||
        data.amount > Math.min(fee.amount, availableAtDate) - fee.paid_amount
      ) {
        conflict(
          "FEE_PAYMENT_EXCEEDS_BALANCE",
          "O pagamento excede o saldo da multa na data informada.",
        );
      }
      insertPayment({
        ...data,
        installment_id: installment.id,
        amount: 0,
        late_fee_amount: data.amount,
      });
      refreshFinancialState(loan.id);
      bumpRevision(loan.id);
      return { fee: getFee(id), loan: getLoan(loan.id) };
    })
    .immediate();
}
