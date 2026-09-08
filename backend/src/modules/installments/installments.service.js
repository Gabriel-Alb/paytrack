import { database } from "../../config/database.js";
import { env } from "../../config/env.js";
import { today } from "../../shared/utils/dates.js";
import * as repository from "./installments.repository.js";

export function refreshClient(id = null, date = today()) {
  for (const client of repository.clientBalances(
    id,
    env.ATTENTION_DAYS,
    date,
  )) {
    const status =
      client.status_override ||
      (client.negative
        ? "negativado"
        : client.open_count
          ? "ativo"
          : client.loan_count
            ? "quitado"
            : "sem_contrato");
    repository.saveClientStatus(client.id, status);
  }
}

export function refreshFinancialState(loanId = null, date = today()) {
  const db = database();
  db.transaction(() => {
    repository.reconcileInstallments(date, loanId);
    repository.reconcileFees(date, loanId);
    const balances = repository.loanBalances(loanId, date);
    for (const loan of balances) {
      const status =
        loan.remaining === 0 && loan.fee_remaining === 0
          ? "paid"
          : loan.days_late > 0 || loan.fee_remaining > 0
            ? "overdue"
            : "active";
      repository.saveLoanStatus(loan.id, status);
    }
    if (loanId === null) refreshClient(null, date);
    else if (balances[0]) refreshClient(balances[0].client_id, date);
  })();
}
