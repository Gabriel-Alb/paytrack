import { unitOfWork } from '../../application/persistence.js';
import { env } from "../../config/env.js";
import { today } from "../../shared/utils/dates.js";
import * as repository from "./installments.repository.js";

// Existing read services reconcile derived balances. Return that current view without
// committing their writes on GET. Financial mutation services still commit normally.
export async function readFinancial(operation) { return (await unitOfWork(operation, { rollback: true })); }

export async function refreshClient(id = null, date = today()) {
  for (const client of (await repository.clientBalances(
    id,
    env.ATTENTION_DAYS,
    date,
  ))) {
    const status =
      client.status_override ||
      (client.negative
        ? "negativado"
        : client.open_count
          ? "ativo"
          : client.loan_count
            ? "quitado"
            : "sem_contrato");
    (await repository.saveClientStatus(client.id, status));
  }
}

export async function refreshFinancialState(loanId = null, date = today()) {
  return (await unitOfWork(async () => {
    (await repository.reconcileInstallments(date, loanId));
    (await repository.reconcileFees(date, loanId));
    const balances = (await repository.loanBalances(loanId, date));
    for (const loan of balances) {
      const status =
        loan.remaining === 0 && loan.fee_remaining === 0
          ? "paid"
          : loan.days_late > 0 || loan.fee_remaining > 0
            ? "overdue"
            : "active";
      (await repository.saveLoanStatus(loan.id, status));
    }
    if (loanId === null) (await refreshClient(null, date));
    else if (balances[0]) (await refreshClient(balances[0].client_id, date));
  }));
}
