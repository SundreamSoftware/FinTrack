import type { Transaction } from './models';
import { normalizeText, parseMoney } from './values';
export interface TransactionFilters {
  search: string;
  from: string;
  to: string;
  account: string;
  category: string;
  merchant: string;
  type: string;
  currency: string;
  direction: string;
  minimum: string;
  maximum: string;
  recurring: string;
  sort: 'DATE_DESC' | 'DATE_ASC' | 'AMOUNT_ASC' | 'AMOUNT_DESC';
}
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const search = normalizeText(filters.search);
  const minimum = filters.minimum ? parseMoney(filters.minimum, filters.currency) : null;
  const maximum = filters.maximum ? parseMoney(filters.maximum, filters.currency) : null;
  return transactions
    .filter((transaction) => {
      if (
        search &&
        !normalizeText(
          [transaction.rawDescription, transaction.counterparty, transaction.note].join(' '),
        ).includes(search)
      )
        return false;
      if (
        (filters.from && transaction.transactionDate < filters.from) ||
        (filters.to && transaction.transactionDate > filters.to)
      )
        return false;
      if (
        (filters.account && transaction.accountId !== filters.account) ||
        (filters.merchant && transaction.merchantId !== filters.merchant)
      )
        return false;
      if (filters.category && (transaction.categoryId ?? 'uncategorized') !== filters.category)
        return false;
      if (
        (filters.type && transaction.type !== filters.type) ||
        (filters.currency && transaction.currency !== filters.currency)
      )
        return false;
      if (
        (filters.direction === 'income' && transaction.amount <= 0) ||
        (filters.direction === 'expense' && transaction.amount >= 0)
      )
        return false;
      if (
        (minimum !== null && transaction.amount < minimum) ||
        (maximum !== null && transaction.amount > maximum)
      )
        return false;
      const recurring =
        transaction.recurringStatus === 'DETECTED' || transaction.recurringStatus === 'CONFIRMED';
      return !(
        (filters.recurring === 'yes' && !recurring) ||
        (filters.recurring === 'no' && recurring)
      );
    })
    .sort((first, second) => {
      switch (filters.sort) {
        case 'DATE_DESC':
          return (
            second.transactionDate.localeCompare(first.transactionDate) ||
            first.id.localeCompare(second.id)
          );
        case 'DATE_ASC':
          return (
            first.transactionDate.localeCompare(second.transactionDate) ||
            first.id.localeCompare(second.id)
          );
        case 'AMOUNT_ASC':
          return first.currency.localeCompare(second.currency) || first.amount - second.amount;
        case 'AMOUNT_DESC':
          return first.currency.localeCompare(second.currency) || second.amount - first.amount;
      }
    });
}
