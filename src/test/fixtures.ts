import { emptySnapshot, type Transaction, type Account } from '../domain/models';
import { fingerprint } from '../domain/categorization';
export const account: Account = {
  id: 'account-1',
  name: 'Test account',
  type: 'CHECKING',
  institutionName: 'Fictional',
  currency: 'PLN',
  initialBalance: 0,
  archived: false,
  demo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
export function transaction(overrides: Partial<Transaction> = {}): Transaction {
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    accountId: account.id,
    transactionDate: '2026-01-15',
    amount: -10000,
    currency: 'PLN',
    rawDescription: 'TEST SHOP',
    normalizedDescription: 'TEST SHOP',
    type: 'EXPENSE',
    source: 'CSV',
    fingerprint: 'pending',
    recurringStatus: 'NONE',
    manualCategory: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  transaction.fingerprint = fingerprint(transaction);
  return transaction;
}
export function snapshot() {
  return { ...emptySnapshot(), accounts: [account] };
}
