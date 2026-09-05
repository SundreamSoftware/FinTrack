import type { CategorizationRule, Merchant, MerchantAlias, Transaction } from './models';
import { normalizeText } from './values';
const knownMerchants = [
  'BIEDRONKA',
  'LIDL',
  'NETFLIX',
  'SPOTIFY',
  'YOUTUBE',
  'AMAZON',
  'UBER',
  'ZABKA',
  'APPLE',
  'ALDI',
];
export function normalizeMerchant(
  description: string,
  aliases: MerchantAlias[] = [],
  merchants: Merchant[] = [],
): string {
  const normalized = normalizeText(description);
  const alias = aliases.find((alias) => normalized.includes(normalizeText(alias.pattern)));
  if (alias)
    return merchants.find((merchant) => merchant.id === alias.merchantId)?.name ?? normalized;
  return (
    knownMerchants.find((name) => normalized.includes(name)) ??
    normalized
      .replace(/\b\d{3,}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
  );
}
export function matchesRule(
  transaction: Transaction,
  rule: CategorizationRule,
  merchantName: string,
): boolean {
  if (!rule.enabled) return false;
  const value = normalizeText(rule.value);
  switch (rule.operator) {
    case 'MERCHANT_CONTAINS':
      return normalizeText(merchantName).includes(value);
    case 'MERCHANT_EQUALS':
      return normalizeText(merchantName) === value;
    case 'DESCRIPTION_CONTAINS':
      return transaction.normalizedDescription.includes(value);
    case 'COUNTERPARTY_CONTAINS':
      return normalizeText(transaction.counterparty ?? '').includes(value);
    case 'AMOUNT_GREATER':
      return transaction.currency === rule.currency && transaction.amount > Number(rule.value);
    case 'AMOUNT_LESS':
      return transaction.currency === rule.currency && transaction.amount < Number(rule.value);
  }
}
const keywords: Record<string, string[]> = {
  groceries: ['BIEDRONKA', 'LIDL', 'ALDI', 'GROCERY', 'ZABKA'],
  restaurants: ['RESTAURANT', 'CAFE', 'RESTAURACJA'],
  subscriptions: ['NETFLIX', 'SPOTIFY', 'YOUTUBE', 'SUBSCRIPTION'],
  salary: ['SALARY', 'WYNAGRODZENIE'],
  housing: ['RENT', 'CZYNSZ', 'ELECTRICITY'],
  transport: ['UBER', 'FUEL', 'PETROL'],
  health: ['PHARMACY', 'APTEKA'],
  fees: ['COMMISSION', 'PROWIZJA'],
};
export interface CategorizationContext {
  rules: CategorizationRule[];
  merchants: Merchant[];
  merchantAliases: MerchantAlias[];
  history: Transaction[];
}
export function createCategorizer(
  context: CategorizationContext,
): (transaction: Transaction) => string | undefined {
  const rules = [...context.rules].sort(
    (first, second) => first.priority - second.priority || first.id.localeCompare(second.id),
  );
  const historical = new Map<string, string>();
  for (const transaction of [...context.history].sort((first, second) =>
    first.updatedAt.localeCompare(second.updatedAt),
  )) {
    if (transaction.manualCategory && transaction.categoryId && transaction.merchantId)
      historical.set(transaction.merchantId, transaction.categoryId);
  }
  const merchants = new Map(context.merchants.map((merchant) => [merchant.id, merchant]));
  return (transaction) => {
    const merchant = transaction.merchantId ? merchants.get(transaction.merchantId) : undefined;
    const name =
      merchant?.name ??
      normalizeMerchant(
        transaction.counterparty || transaction.rawDescription,
        context.merchantAliases,
        context.merchants,
      );
    const userRule = rules.find((rule) => matchesRule(transaction, rule, name));
    if (userRule) return userRule.categoryId;
    if (merchant?.categoryId) return merchant.categoryId;
    if (transaction.merchantId && historical.has(transaction.merchantId))
      return historical.get(transaction.merchantId);
    for (const [categoryId, terms] of Object.entries(keywords))
      if (
        terms.some(
          (term) =>
            transaction.normalizedDescription.includes(term) || normalizeText(name).includes(term),
        )
      )
        return categoryId;
    return undefined;
  };
}
export function fingerprint(
  transaction: Pick<
    Transaction,
    | 'accountId'
    | 'transactionDate'
    | 'amount'
    | 'currency'
    | 'normalizedDescription'
    | 'counterparty'
  >,
): string {
  return JSON.stringify([
    transaction.accountId,
    transaction.transactionDate,
    transaction.amount,
    transaction.currency,
    transaction.normalizedDescription,
    normalizeText(transaction.counterparty ?? ''),
  ]);
}
export type DuplicateStatus = 'NEW' | 'DUPLICATE' | 'POTENTIAL_DUPLICATE';
export function classifyDuplicates(
  incoming: Transaction[],
  existing: Transaction[],
): DuplicateStatus[] {
  const available = new Map<string, number>();
  const similar = new Set<string>();
  const seen = new Set<string>();
  const similarityKey = (transaction: Transaction) =>
    JSON.stringify([
      transaction.accountId,
      transaction.transactionDate,
      transaction.amount,
      transaction.currency,
    ]);
  for (const transaction of existing) {
    available.set(transaction.fingerprint, (available.get(transaction.fingerprint) ?? 0) + 1);
    similar.add(similarityKey(transaction));
  }
  return incoming.map((transaction) => {
    const count = available.get(transaction.fingerprint) ?? 0;
    if (count > 0) {
      available.set(transaction.fingerprint, count - 1);
      seen.add(transaction.fingerprint);
      return 'DUPLICATE';
    }
    const potential = seen.has(transaction.fingerprint) || similar.has(similarityKey(transaction));
    seen.add(transaction.fingerprint);
    return potential ? 'POTENTIAL_DUPLICATE' : 'NEW';
  });
}
