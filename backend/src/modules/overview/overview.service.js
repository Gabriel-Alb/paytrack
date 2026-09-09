import * as repository from "./overview.repository.js";
import { refreshFinancialState } from "../installments/installments.service.js";
import { addDays, today } from "../../shared/utils/dates.js";
import { pagination } from "../../shared/utils/validation.js";
import { env } from "../../config/env.js";

function variation(current, previous) {
  return previous ? ((current - previous) / previous) * 100 : null;
}

export function dashboard() {
  refreshFinancialState();
  const date = today();
  const monthStart = date.slice(0, 7) + "-01";
  const previousEnd = addDays(monthStart, -1);
  const previousStart = previousEnd.slice(0, 7) + "-01";
  const portfolio = repository.portfolioAt(date);
  const receipts = repository.receipts(monthStart, date);
  const status = repository.portfolioStatus(date, env.ATTENTION_DAYS);
  const days = repository.receiptDays(addDays(date, -6), date);
  return {
    today: date,
    portfolio,
    active_loans: status.total,
    portfolio_change: variation(portfolio, repository.portfolioAt(previousEnd)),
    received: receipts.amount,
    payment_count: receipts.count,
    received_change: variation(
      receipts.amount,
      repository.receipts(previousStart, previousEnd).amount,
    ),
    portfolio_status: status,
    receipt_chart: Array.from({ length: 7 }, (_, index) => {
      const day = addDays(date, index - 6);
      return {
        date: day,
        value: days.find((item) => item.date === day)?.value ?? 0,
      };
    }),
    upcoming: repository.upcoming(date),
  };
}

export function report(query) {
  refreshFinancialState();
  const result = repository.report(pagination(query), today());
  const receipts = repository.receiptDays(query.start, query.end);
  const chart = [];
  const groupSize = query.mode === "month" ? 7 : 1;
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

export function notifications(includeActivity = false) {
  refreshFinancialState();
  const items = repository.notifications(today(),includeActivity);
  if (!includeActivity) return items;
  const timestamp = (value) => Date.parse(value.includes('T') ? value : value.replace(' ','T')+'Z');
  return [...repository.actionNotifications(),...items]
    .sort((a,b) => timestamp(b.datetime)-timestamp(a.datetime)).slice(0,100);
}
