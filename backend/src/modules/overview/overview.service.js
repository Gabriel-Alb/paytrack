import * as repository from "./overview.repository.js";
import { refreshFinancialState } from "../installments/installments.service.js";
import { addDays, today, visualStatus } from "../../shared/utils/dates.js";
import { loansDueInPeriod } from "../loans/loans.repository.js";
import { pagination } from "../../shared/utils/validation.js";
import { env } from "../../config/env.js";

function variation(current, previous) {
  return previous ? ((current - previous) / previous) * 100 : null;
}

export async function dashboard() {
  (await refreshFinancialState());
  const date = today();
  const monthStart = date.slice(0, 7) + "-01";
  const previousEnd = addDays(monthStart, -1);
  const previousStart = previousEnd.slice(0, 7) + "-01";
  const portfolio = (await repository.portfolioAt(date));
  const receipts = (await repository.receipts(monthStart, date));
  const status = (await repository.portfolioStatus(date, env.ATTENTION_DAYS));
  const days = (await repository.receiptDays(addDays(date, -6), date));
  return {
    today: date,
    portfolio,
    active_loans: status.total,
    portfolio_change: variation(portfolio, (await repository.portfolioAt(previousEnd))),
    received: receipts.amount,
    payment_count: receipts.count,
    received_change: variation(
      receipts.amount,
      (await repository.receipts(previousStart, previousEnd)).amount,
    ),
    portfolio_status: status,
    receipt_chart: Array.from({ length: 7 }, (_, index) => {
      const day = addDays(date, index - 6);
      return {
        date: day,
        value: days.find((item) => item.date === day)?.value ?? 0,
      };
    }),
    upcoming: (await repository.upcoming(date)),
  };
}

export async function report(query) {
  (await refreshFinancialState());
  if (query.mode === "month") return (await monthlyReport(query));
  const result = (await repository.report(pagination(query), today()));
  const receipts = (await repository.receiptDays(query.start, query.end));
  const chart = [];
  const groupSize = 1;
  for (
    let start = query.start;
    start <= query.end;
    start = addDays(start, groupSize)
  ) {
    const end =
      addDays(start, groupSize - 1) > query.end
        ? query.end
        : addDays(start, groupSize - 1);
    chart.push({
      start,
      end,
      value: receipts
        .filter((item) => item.date >= start && item.date <= end)
        .reduce((sum, item) => sum + item.value, 0),
    });
  }
  return { ...result, chart, page: query.page, limit: query.limit };
}

async function monthlyReport({ start, end }) {
  const date = today();
  const { installments, contracts, cash } = (await repository.monthlyReport(start, end, date));
  const summary = { capital: 0, ...cash, pending: 0, expectedInterest: 0, expectedProfit: 0 };
  for (const contract of contracts) summary.capital += contract.amount;
  const agenda = new Map();
  const dueByContract = new Map();
  const priority = { 'on-time': 0, attention: 1, overdue: 2 };
  for (const row of installments) {
    summary.pending += row.pending;
    summary.expectedInterest += row.expectedInterest;
    summary.expectedProfit += row.expectedProfit;
    const status = visualStatus(row.installmentDaysLate, Boolean(row.feePending));
    const day = agenda.get(row.date) ?? {
      date: row.date, count: 0, expected: 0, received: 0, paid: 0, pending: 0, late: 0,
      status: 'on-time',
    };
    day.count++;
    day.expected += row.expected;
    day.received += row.received;
    if (!row.pending) day.paid++;
    else if (status === 'on-time') day.pending++;
    else day.late++;
    if (priority[status] > priority[day.status]) day.status = status;
    agenda.set(row.date, day);
    const due = dueByContract.get(row.contractId) ?? { expected: 0, pending: 0, representative: row };
    due.expected += row.expected;
    due.pending += row.pending;
    if (row.pending && !due.representative.pending) due.representative = row;
    dueByContract.set(row.contractId, due);
  }
  const contractStatuses = (await loansDueInPeriod(start, end, date)).map((loan) => {
    const due = dueByContract.get(loan.id);
    return {
      id: loan.id, client: loan.client_name,
      status: visualStatus(loan.days_late, loan.fee_remaining > 0), daysLate: loan.days_late,
      date: due.representative.date, installmentNumber: due.representative.installmentNumber,
      installmentCount: loan.installment_count, expected: due.expected, pending: due.pending,
    };
  });
  return {
    today: date, summary, contracts, contractStatuses,
    agenda: [...agenda.values()].map((day) => ({
      ...day, status: day.status === 'on-time' && day.pending > 0 && day.date > date ? 'pending' : day.status,
    })),
    receiptDays: (await repository.receiptDays(start, end)),
  };
}

export async function notifications(includeActivity = false) {
  (await refreshFinancialState());
  const items = (await repository.notifications(today(),includeActivity));
  const timestamp = (value) => Date.parse(value.includes('T') ? value : value.replace(' ','T')+'Z');
  return [...(await repository.actionNotifications(includeActivity)),...items]
    .sort((a,b) => timestamp(b.datetime)-timestamp(a.datetime)).slice(0,100);
}
