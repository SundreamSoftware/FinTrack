import type { Merchant, Subscription, Transaction } from './models';
import { dayDistance, nextCalendarPayment, safeMoney, sumMoney, today } from './values';
import { normalizeMerchant } from './categorization';
export const MINIMUM_OCCURRENCES = 3;
export const AMOUNT_TOLERANCE = 0.12;
export const MINIMUM_CONFIDENCE = 0.7;
const periods = [
  { frequency: 'WEEKLY', minimum: 6, maximum: 8, days: 7 },
  { frequency: 'MONTHLY', minimum: 25, maximum: 35, days: 30 },
  { frequency: 'YEARLY', minimum: 350, maximum: 380, days: 365 },
] as const;
export function detectSubscriptions(
  transactions: Transaction[],
  merchants: Merchant[],
  previous: Subscription[],
  asOf = today(),
): Subscription[] {
  const names = new Map(merchants.map((merchant) => [merchant.id, merchant.name]));
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.amount >= 0 || transaction.type === 'TRANSFER' || transaction.type === 'REFUND')
      continue;
    const name =
      names.get(transaction.merchantId ?? '') ??
      normalizeMerchant(transaction.counterparty || transaction.rawDescription);
    const key = JSON.stringify([transaction.accountId, transaction.currency, name]);
    const group = groups.get(key) ?? [];
    group.push(transaction);
    groups.set(key, group);
  }
  const candidates: Subscription[] = [];
  for (const [key, group] of groups) {
    if (group.length < MINIMUM_OCCURRENCES) continue;
    group.sort((first, second) => first.transactionDate.localeCompare(second.transactionDate));
    const amounts = group
      .map((transaction) => -transaction.amount)
      .sort((first, second) => first - second);
    const median = amounts[Math.floor(amounts.length / 2)] ?? 0;
    if (!median) continue;
    const coherent = group.filter(
      (transaction) => Math.abs(-transaction.amount - median) / median <= AMOUNT_TOLERANCE,
    );
    if (coherent.length < MINIMUM_OCCURRENCES || coherent.length / group.length < 0.75) continue;
    const intervals = coherent
      .slice(1)
      .map((transaction, index) =>
        dayDistance(
          coherent[index]?.transactionDate ?? transaction.transactionDate,
          transaction.transactionDate,
        ),
      );
    const period = periods.find(
      (period) =>
        intervals.every(
          (interval) =>
            (interval >= period.minimum && interval <= period.maximum) ||
            (interval >= period.minimum * 2 && interval <= period.maximum * 2),
        ) && intervals.filter((interval) => interval > period.maximum).length <= 1,
    );
    if (!period) continue;
    const amount = safeMoney(
      Math.round(sumMoney(coherent.map((transaction) => -transaction.amount)) / coherent.length),
    );
    const amountConsistency =
      1 -
      Math.min(
        1,
        Math.max(
          ...coherent.map((transaction) => Math.abs(-transaction.amount - amount) / amount),
        ) / AMOUNT_TOLERANCE,
      );
    const intervalConsistency =
      intervals.filter((interval) => interval >= period.minimum && interval <= period.maximum)
        .length / intervals.length;
    // Weights: exact normalized merchant 25%, amount consistency 30%, interval consistency 30%, occurrence evidence 15%.
    const confidence = Number(
      (
        0.25 +
        0.3 * amountConsistency +
        0.3 * intervalConsistency +
        0.15 * Math.min(1, coherent.length / 6)
      ).toFixed(2),
    );
    if (confidence < MINIMUM_CONFIDENCE) continue;
    const last = coherent.at(-1);
    const first = coherent[0];
    if (!last || !first) continue;
    const existing = previous.find(
      (subscription) => subscription.key === key && subscription.frequency === period.frequency,
    );
    const materiallyChanged = existing
      ? Math.abs(existing.amount - amount) / Math.max(1, existing.amount) > AMOUNT_TOLERANCE
      : false;
    const status = existing && !materiallyChanged ? existing.status : 'DETECTED';
    let nextPayment = nextCalendarPayment(last.transactionDate, period.frequency);
    while (nextPayment < asOf) nextPayment = nextCalendarPayment(nextPayment, period.frequency);
    candidates.push({
      id: existing?.id ?? crypto.randomUUID(),
      key,
      merchantName:
        names.get(first.merchantId ?? '') ??
        normalizeMerchant(first.counterparty || first.rawDescription),
      merchantId: first.merchantId,
      accountId: first.accountId,
      currency: first.currency,
      amount,
      frequency: period.frequency,
      nextPayment,
      confidence,
      occurrences: coherent.length,
      status,
      transactionIds: coherent.map((transaction) => transaction.id),
      signature: JSON.stringify([period.frequency, amount]),
    });
  }
  const keys = new Set(candidates.map((candidate) => candidate.id));
  return [...candidates, ...previous.filter((subscription) => !keys.has(subscription.id))];
}
