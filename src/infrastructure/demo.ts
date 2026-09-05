import { emptySnapshot, type Snapshot, type Transaction } from '../domain/models';
import { metadata, monthOffset, normalizeText, today } from '../domain/values';
import { createCategorizer, fingerprint } from '../domain/categorization';
import { detectSubscriptions } from '../domain/subscriptions';
export function createDemo(): Snapshot {
  const snapshot = emptySnapshot();
  const account = {
    ...metadata(),
    name: 'Everyday · Demo',
    institutionName: 'Fictional Bank',
    type: 'CHECKING' as const,
    currency: 'PLN',
    initialBalance: 1800000,
    archived: false,
    demo: true,
  };
  snapshot.accounts.push(account);
  const merchantTerms = [
    ['SALARY', 'salary'],
    ['RENT', 'housing'],
    ['BIEDRONKA', 'groceries'],
    ['NETFLIX', 'subscriptions'],
    ['SPOTIFY', 'subscriptions'],
    ['RESTAURANT', 'restaurants'],
    ['UBER', 'transport'],
    ['AMAZON', 'shopping'],
  ] as const;
  snapshot.merchants = merchantTerms.map(([name, categoryId]) => ({
    id: crypto.randomUUID(),
    name,
    categoryId,
  }));
  const categorize = createCategorizer({ ...snapshot, history: [] });
  const current = today().slice(0, 7);
  for (let offset = -6; offset <= 0; offset++) {
    const month = monthOffset(current, offset);
    const entries: [number, number, string][] = [
      [1, 980000, 'SALARY'],
      [2, -235000, 'RENT'],
      [3, -4990, 'NETFLIX'],
      [4, -2399, 'SPOTIFY'],
      [5, -28750 - offset * 400, 'BIEDRONKA'],
      [8, -18200, 'RESTAURANT'],
      [12, -6500, 'UBER'],
      [16, -31800, 'BIEDRONKA'],
      [20, -42900 + offset * 1700, 'AMAZON'],
      [23, -14900, 'RESTAURANT'],
      [27, -26400, 'BIEDRONKA'],
    ];
    for (const [day, amount, name] of entries) {
      const transactionDate = `${month}-${String(day).padStart(2, '0')}`;
      if (transactionDate > today()) continue;
      const transaction: Transaction = {
        ...metadata(),
        accountId: account.id,
        transactionDate,
        amount,
        currency: 'PLN',
        rawDescription: name,
        normalizedDescription: normalizeText(name),
        counterparty: name,
        merchantId: snapshot.merchants.find((merchant) => merchant.name === name)?.id,
        type: amount > 0 ? 'INCOME' : 'EXPENSE',
        source: 'DEMO',
        fingerprint: 'pending',
        recurringStatus: 'NONE',
        manualCategory: false,
      };
      transaction.fingerprint = fingerprint(transaction);
      transaction.categoryId = categorize(transaction);
      snapshot.transactions.push(transaction);
    }
  }
  snapshot.budgets = [
    {
      ...metadata(),
      categoryId: 'groceries',
      amount: 110000,
      currency: 'PLN',
      month: current,
      recurrence: 'MONTHLY',
    },
    {
      ...metadata(),
      categoryId: 'shopping',
      amount: 60000,
      currency: 'PLN',
      month: current,
      recurrence: 'MONTHLY',
    },
    {
      ...metadata(),
      categoryId: 'restaurants',
      amount: 40000,
      currency: 'PLN',
      month: current,
      recurrence: 'MONTHLY',
    },
  ];
  snapshot.subscriptions = detectSubscriptions(snapshot.transactions, snapshot.merchants, []);
  return snapshot;
}
