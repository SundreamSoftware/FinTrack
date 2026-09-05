import { z } from 'zod';
import {
  accountSchema,
  aliasSchema,
  budgetSchema,
  categorySchema,
  importSchema,
  merchantSchema,
  ruleSchema,
  settingSchema,
  subscriptionSchema,
  transactionSchema,
  type Snapshot,
} from '../domain/models';
import { sumMoney } from '../domain/values';
export const MAX_BACKUP_BYTES = 40 * 1024 * 1024;
const collection = <T extends z.ZodType>(schema: T) => z.array(schema).max(100000);
export const snapshotSchema = z.object({
  accounts: collection(accountSchema),
  transactions: collection(transactionSchema),
  categories: collection(categorySchema),
  merchants: collection(merchantSchema),
  merchantAliases: collection(aliasSchema),
  rules: collection(ruleSchema),
  imports: collection(importSchema),
  budgets: collection(budgetSchema),
  subscriptions: collection(subscriptionSchema),
  settings: collection(settingSchema),
});
export function validateSnapshot(input: unknown): Snapshot {
  const snapshot = snapshotSchema.parse(input);
  for (const collection of Object.values(snapshot)) {
    if (new Set(collection.map((record) => record.id)).size !== collection.length)
      throw new Error('Backup contains duplicate IDs');
  }
  const accounts = new Map(snapshot.accounts.map((account) => [account.id, account]));
  const categories = new Set(snapshot.categories.map((category) => category.id));
  const merchants = new Set(snapshot.merchants.map((merchant) => merchant.id));
  const imports = new Set(snapshot.imports.map((record) => record.id));
  const transactions = new Map(
    snapshot.transactions.map((transaction) => [transaction.id, transaction]),
  );
  for (const transaction of snapshot.transactions) {
    if (
      accounts.get(transaction.accountId)?.currency !== transaction.currency ||
      (transaction.categoryId && !categories.has(transaction.categoryId)) ||
      (transaction.merchantId && !merchants.has(transaction.merchantId)) ||
      (transaction.importId && !imports.has(transaction.importId))
    )
      throw new Error('Backup contains invalid transaction references');
  }
  for (const record of [...snapshot.rules, ...snapshot.budgets])
    if (!categories.has(record.categoryId)) throw new Error('Backup references a missing category');
  for (const merchant of snapshot.merchants)
    if (merchant.categoryId && !categories.has(merchant.categoryId))
      throw new Error('Backup merchant references a missing category');
  for (const alias of snapshot.merchantAliases)
    if (!merchants.has(alias.merchantId))
      throw new Error('Backup alias references a missing merchant');
  for (const record of snapshot.imports)
    if (!accounts.has(record.accountId))
      throw new Error('Backup import references a missing account');
  for (const subscription of snapshot.subscriptions) {
    if (
      accounts.get(subscription.accountId)?.currency !== subscription.currency ||
      (subscription.merchantId && !merchants.has(subscription.merchantId)) ||
      subscription.transactionIds.some(
        (id) =>
          transactions.get(id)?.accountId !== subscription.accountId ||
          transactions.get(id)?.currency !== subscription.currency,
      )
    )
      throw new Error('Backup contains invalid subscription references');
  }
  for (const currency of new Set(snapshot.accounts.map((account) => account.currency)))
    sumMoney([
      ...snapshot.transactions
        .filter((transaction) => transaction.currency === currency)
        .map((transaction) => Math.abs(transaction.amount)),
      ...snapshot.accounts
        .filter((account) => account.currency === currency)
        .map((account) => Math.abs(account.initialBalance)),
    ]);
  return snapshot;
}
export function serializeBackup(snapshot: Snapshot): string {
  return JSON.stringify(
    { formatVersion: 1, exportedAt: new Date().toISOString(), ...snapshot },
    null,
    2,
  );
}
export function parseBackup(content: string): Snapshot {
  if (new TextEncoder().encode(content).length > MAX_BACKUP_BYTES)
    throw new Error('Backup exceeds the 40 MB limit');
  const parsed: unknown = JSON.parse(content);
  const envelope = z
    .object({ formatVersion: z.literal(1), exportedAt: z.iso.datetime() })
    .safeParse(parsed);
  if (!envelope.success) throw new Error('Unsupported or invalid FinTrack backup');
  return validateSnapshot(parsed);
}
export function downloadBackup(snapshot: Snapshot): void {
  const url = URL.createObjectURL(
    new Blob([serializeBackup(snapshot)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fintrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
