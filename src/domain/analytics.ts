import type { Budget, Subscription, Transaction } from './models';
import { monthOffset, safeMoney, sumMoney, today } from './values';
export interface CashFlow {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number | null;
}
export function cashFlow(transactions: Transaction[], currency: string, month = ''): CashFlow {
  let income = 0;
  let expenses = 0;
  for (const transaction of transactions) {
    if (
      transaction.currency !== currency ||
      !transaction.transactionDate.startsWith(month) ||
      transaction.type === 'TRANSFER'
    )
      continue;
    if (transaction.type === 'REFUND') {
      expenses = sumMoney([expenses, -transaction.amount]);
    } else if (transaction.amount > 0) {
      income = sumMoney([income, transaction.amount]);
    } else expenses = sumMoney([expenses, -transaction.amount]);
  }
  const net = sumMoney([income, -expenses]);
  return { month, income, expenses, net, savingsRate: income === 0 ? null : (net / income) * 100 };
}
export function expenseContribution(transaction: Transaction): number {
  if (transaction.type === 'TRANSFER') return 0;
  if (transaction.type === 'REFUND') return -transaction.amount;
  return Math.max(0, -transaction.amount);
}
export function categoryTotals(
  transactions: Transaction[],
  currency: string,
  month: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.currency !== currency || !transaction.transactionDate.startsWith(month))
      continue;
    const key = transaction.categoryId ?? 'uncategorized';
    totals.set(key, sumMoney([totals.get(key) ?? 0, expenseContribution(transaction)]));
  }
  return totals;
}
export const BUDGET_WARNING_PERCENT = 80;
export const BUDGET_EXCEEDED_PERCENT = 100;
export function budgetUsage(
  budget: Budget,
  spent: number,
): { spent: number; remaining: number; usage: number; status: 'OK' | 'WARNING' | 'EXCEEDED' } {
  const usage = budget.amount === 0 ? (spent > 0 ? 100 : 0) : (spent / budget.amount) * 100;
  return {
    spent,
    remaining: sumMoney([budget.amount, -spent]),
    usage,
    status:
      usage >= BUDGET_EXCEEDED_PERCENT
        ? 'EXCEEDED'
        : usage >= BUDGET_WARNING_PERCENT
          ? 'WARNING'
          : 'OK',
  };
}
export function activeBudgets(budgets: Budget[], month: string, currency: string): Budget[] {
  return budgets.filter(
    (budget) =>
      budget.currency === currency &&
      (budget.month === month || (budget.recurrence === 'MONTHLY' && budget.month <= month)),
  );
}
export function monthlySeries(
  transactions: Transaction[],
  currency: string,
  count: number | 'ALL',
  end = today().slice(0, 7),
): CashFlow[] {
  const dates = transactions
    .filter((transaction) => transaction.currency === currency)
    .map((transaction) => transaction.transactionDate.slice(0, 7));
  const first = dates.reduce((earliest, date) => (date < earliest ? date : earliest), end);
  const start = count === 'ALL' ? first : monthOffset(end, 1 - count);
  const buckets = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const month = transaction.transactionDate.slice(0, 7);
    const bucket = buckets.get(month) ?? [];
    bucket.push(transaction);
    buckets.set(month, bucket);
  }
  const flows: CashFlow[] = [];
  for (let month = start; month <= end; month = monthOffset(month, 1)) {
    flows.push(cashFlow(buckets.get(month) ?? [], currency, month));
    if (flows.length >= 1200) break;
  }
  return flows;
}
export function monthlySubscriptionCost(subscription: Subscription): number {
  return safeMoney(
    Math.round(
      subscription.amount *
        (subscription.frequency === 'WEEKLY'
          ? 52 / 12
          : subscription.frequency === 'YEARLY'
            ? 1 / 12
            : 1),
    ),
  );
}
export interface Forecast {
  historyMonths: number;
  averageIncome: number;
  averageFixedExpenses: number;
  averageVariableExpenses: number;
  knownRecurringExpenses: number;
  monthlyTrend: number;
  expectedMonthlySavings: number;
  points: { month: string; expected: number; lower: number; upper: number }[];
}
export function forecastSavings(
  transactions: Transaction[],
  subscriptions: Subscription[],
  currency: string,
  horizon: number,
  currentMonth = today().slice(0, 7),
): Forecast {
  const complete = transactions.filter(
    (transaction) =>
      transaction.currency === currency && transaction.transactionDate.slice(0, 7) < currentMonth,
  );
  const first = complete.reduce(
    (earliest, transaction) =>
      transaction.transactionDate.slice(0, 7) < earliest
        ? transaction.transactionDate.slice(0, 7)
        : earliest,
    currentMonth,
  );
  const series = monthlySeries(complete, currency, 6, monthOffset(currentMonth, -1)).filter(
    (flow) => flow.month >= first,
  );
  const count = series.length;
  const average = (amounts: number[]) =>
    count ? safeMoney(Math.round(sumMoney(amounts) / count)) : 0;
  const averageIncome = average(series.map((flow) => flow.income));
  const recurringIds = new Set(
    subscriptions
      .filter(
        (subscription) => subscription.status === 'CONFIRMED' || subscription.status === 'DETECTED',
      )
      .flatMap((subscription) => subscription.transactionIds),
  );
  const fixed = series.map((flow) =>
    sumMoney(
      complete
        .filter(
          (transaction) =>
            transaction.transactionDate.startsWith(flow.month) && recurringIds.has(transaction.id),
        )
        .map(expenseContribution),
    ),
  );
  const averageFixedExpenses = average(fixed);
  const variable = series.map((flow, index) => sumMoney([flow.expenses, -(fixed[index] ?? 0)]));
  const averageVariableExpenses = average(variable);
  const knownRecurringExpenses = sumMoney(
    subscriptions
      .filter(
        (subscription) =>
          subscription.currency === currency &&
          (subscription.status === 'CONFIRMED' || subscription.status === 'DETECTED'),
      )
      .map(monthlySubscriptionCost),
  );
  const monthlyTrend =
    count >= 3
      ? safeMoney(
          Math.round(
            Math.max(
              -Math.abs(averageVariableExpenses) * 0.2,
              Math.min(
                Math.abs(averageVariableExpenses) * 0.2,
                ((variable.at(-1) ?? 0) - (variable[0] ?? 0)) / (count - 1),
              ),
            ),
          ),
        )
      : 0;
  const expectedMonthlySavings = count
    ? sumMoney([averageIncome, -averageVariableExpenses, -knownRecurringExpenses, -monthlyTrend])
    : 0;
  const averageNet = average(series.map((flow) => flow.net));
  const deviation =
    count > 1
      ? Math.sqrt(
          series.reduce((total, flow) => total + (flow.net - averageNet) ** 2, 0) / (count - 1),
        )
      : Math.abs(expectedMonthlySavings) * 0.25;
  const points = Array.from({ length: horizon }, (_, index) => {
    const months = index + 1;
    const expected = safeMoney(expectedMonthlySavings * months);
    const margin = safeMoney(
      Math.round((deviation + Math.abs(expectedMonthlySavings) * 0.1) * Math.sqrt(months)),
    );
    return {
      month: monthOffset(currentMonth, index),
      expected,
      lower: sumMoney([expected, -margin]),
      upper: sumMoney([expected, margin]),
    };
  });
  return {
    historyMonths: count,
    averageIncome,
    averageFixedExpenses,
    averageVariableExpenses,
    knownRecurringExpenses,
    monthlyTrend,
    expectedMonthlySavings,
    points,
  };
}
export interface Insight {
  id: string;
  text: string;
}
export function financialInsights(
  transactions: Transaction[],
  budgets: Budget[],
  currency: string,
  month: string,
): Insight[] {
  const current = cashFlow(transactions, currency, month);
  const previous = cashFlow(transactions, currency, monthOffset(month, -1));
  const totals = categoryTotals(transactions, currency, month);
  const insights: Insight[] = [];
  for (const budget of activeBudgets(budgets, month, currency)) {
    const usage = budgetUsage(budget, totals.get(budget.categoryId) ?? 0);
    if (usage.usage >= 80)
      insights.push({
        id: budget.id,
        text: `${Math.round(usage.usage)}% of your ${budget.categoryId} budget is used (${usage.status.toLowerCase()}).`,
      });
  }
  if (current.savingsRate !== null && previous.savingsRate !== null)
    insights.push({
      id: 'savings',
      text: `Your savings rate changed by ${(current.savingsRate - previous.savingsRate).toFixed(1)} percentage points from last month.`,
    });
  const history = monthlySeries(transactions, currency, 6, monthOffset(month, -1));
  const firstMonth = transactions
    .filter((transaction) => transaction.currency === currency)
    .reduce(
      (first, transaction) =>
        transaction.transactionDate.slice(0, 7) < first
          ? transaction.transactionDate.slice(0, 7)
          : first,
      month,
    );
  const observed = history.filter((flow) => flow.month >= firstMonth);
  const average = observed.length
    ? sumMoney(observed.map((flow) => flow.expenses)) / observed.length
    : 0;
  if (average > 0 && current.expenses > average * 1.2)
    insights.push({
      id: 'spending',
      text: `This month's expenses are ${Math.round((current.expenses / average - 1) * 100)}% above your previous ${observed.length}-month average. Current month may be incomplete.`,
    });
  return insights;
}
