import type { FinanceRepository } from '../domain/repository';
import {
  accountSchema,
  budgetSchema,
  categorySchema,
  ruleSchema,
  transactionSchema,
  subscriptionSchema,
  merchantSchema,
  aliasSchema,
  emptySnapshot,
  type Account,
  type Budget,
  type CategorizationRule,
  type Category,
  type Merchant,
  type MerchantAlias,
  type Snapshot,
  type Subscription,
  type Transaction,
  type ImportRecord,
} from '../domain/models';
import {
  createCategorizer,
  matchesRule,
  normalizeMerchant,
  normalizeTransactionMerchant,
} from '../domain/categorization';
import { validateSnapshot } from './backup';
import { FinTrackDatabase } from './database';
import type { PreviewRow } from './csv';
export class IndexedDbFinanceRepository implements FinanceRepository {
  constructor(readonly database: FinTrackDatabase) {}
  async initialize(): Promise<void> {
    await this.database.transaction('rw', this.database.tables, async () => {
      if (!(await this.database.settings.get('initialized'))) {
        await this.database.categories.bulkPut(emptySnapshot().categories);
        await this.database.settings.put({ id: 'initialized', value: 'true' });
      }
    });
  }
  async read(): Promise<Snapshot> {
    return this.database.transaction('r', this.database.tables, async () => ({
      accounts: await this.database.accounts.toArray(),
      transactions: await this.database.transactions.toArray(),
      categories: await this.database.categories.toArray(),
      merchants: await this.database.merchants.toArray(),
      merchantAliases: await this.database.merchantAliases.toArray(),
      rules: await this.database.rules.toArray(),
      imports: await this.database.imports.toArray(),
      budgets: await this.database.budgets.toArray(),
      subscriptions: await this.database.subscriptions.toArray(),
      settings: await this.database.settings.toArray(),
    }));
  }
  async saveAccount(account: Account): Promise<void> {
    accountSchema.parse(account);
    await this.database.transaction(
      'rw',
      this.database.accounts,
      this.database.transactions,
      async () => {
        const existing = await this.database.accounts.get(account.id);
        if (
          existing &&
          existing.currency !== account.currency &&
          (await this.database.transactions.where('accountId').equals(account.id).count())
        )
          throw new Error('Currency cannot change on an account with transactions');
        await this.database.accounts.put(account);
      },
    );
  }
  async deleteAccount(id: string): Promise<void> {
    await this.database.transaction('rw', this.database.tables, async () => {
      await this.database.transactions.where('accountId').equals(id).delete();
      await this.database.imports.where('accountId').equals(id).delete();
      await this.database.subscriptions.where('accountId').equals(id).delete();
      await this.database.accounts.delete(id);
    });
  }
  async saveCategory(category: Category): Promise<void> {
    await this.database.categories.put(categorySchema.parse(category));
  }
  async saveMerchant(merchant: Merchant, alias: MerchantAlias): Promise<void> {
    await this.database.transaction(
      'rw',
      this.database.merchants,
      this.database.merchantAliases,
      async () => {
        await this.database.merchants.put(merchantSchema.parse(merchant));
        await this.database.merchantAliases.put(aliasSchema.parse(alias));
      },
    );
  }
  async saveBudget(budget: Budget): Promise<void> {
    budgetSchema.parse(budget);
    await this.database.transaction(
      'rw',
      this.database.budgets,
      this.database.categories,
      async () => {
        if (!(await this.database.categories.get(budget.categoryId)))
          throw new Error('Choose an existing category');
        const existing = await this.database.budgets
          .where('categoryId')
          .equals(budget.categoryId)
          .toArray();
        if (
          existing.some(
            (other) =>
              other.id !== budget.id &&
              other.currency === budget.currency &&
              (other.month === budget.month ||
                (other.recurrence === 'MONTHLY' && budget.month >= other.month) ||
                (budget.recurrence === 'MONTHLY' && other.month >= budget.month)),
          )
        )
          throw new Error('A budget already covers this category, currency and month');
        await this.database.budgets.put(budget);
      },
    );
  }
  async deleteBudget(id: string): Promise<void> {
    await this.database.budgets.delete(id);
  }
  async saveRule(rule: CategorizationRule, applyExisting: boolean): Promise<void> {
    ruleSchema.parse(rule);
    await this.database.transaction('rw', this.database.tables, async () => {
      if (!(await this.database.categories.get(rule.categoryId)))
        throw new Error('Choose an existing category');
      await this.database.rules.put(rule);
      if (applyExisting) {
        const snapshot = await this.read();
        const categorize = createCategorizer({ ...snapshot, history: snapshot.transactions });
        const matching = snapshot.transactions.filter((transaction) =>
          matchesRule(
            transaction,
            rule,
            snapshot.merchants.find((merchant) => merchant.id === transaction.merchantId)?.name ??
              normalizeMerchant(transaction.counterparty || transaction.rawDescription),
          ),
        );
        await this.database.transactions.bulkPut(
          matching.map((transaction) => ({
            ...transaction,
            categoryId: categorize(transaction),
            manualCategory: false,
            updatedAt: new Date().toISOString(),
          })),
        );
      }
    });
  }
  async deleteRule(id: string): Promise<void> {
    await this.database.rules.delete(id);
  }
  async updateTransaction(transaction: Transaction): Promise<void> {
    transactionSchema.parse(transaction);
    await this.database.transaction(
      'rw',
      this.database.transactions,
      this.database.categories,
      async () => {
        if (!(await this.database.transactions.get(transaction.id)))
          throw new Error('Transaction no longer exists');
        if (transaction.categoryId && !(await this.database.categories.get(transaction.categoryId)))
          throw new Error('Category no longer exists');
        await this.database.transactions.put({
          ...transaction,
          updatedAt: new Date().toISOString(),
        });
      },
    );
  }
  async correctTransaction(
    transaction: Transaction,
    rule: CategorizationRule | undefined,
    applyExisting: boolean,
  ): Promise<void> {
    await this.database.transaction('rw', this.database.tables, async () => {
      await this.updateTransaction(transaction);
      if (rule) await this.saveRule(rule, applyExisting);
    });
  }
  async saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
    subscriptions.forEach((subscription) => subscriptionSchema.parse(subscription));
    await this.database.transaction(
      'rw',
      this.database.subscriptions,
      this.database.transactions,
      async () => {
        await this.database.subscriptions.bulkPut(subscriptions);
        const transactions = await this.database.transactions.toArray();
        const statuses = new Map(
          subscriptions.flatMap((subscription) =>
            subscription.transactionIds.map((id) => [id, subscription.status] as const),
          ),
        );
        await this.database.transactions.bulkPut(
          transactions
            .filter((transaction) => statuses.has(transaction.id))
            .map((transaction) => ({
              ...transaction,
              recurringStatus: statuses.get(transaction.id) ?? 'NONE',
            })),
        );
      },
    );
  }
  async setSetting(id: string, value: string): Promise<void> {
    await this.database.settings.put({ id, value });
  }
  async replace(snapshot: Snapshot): Promise<void> {
    const valid = validateSnapshot(snapshot);
    await this.database.transaction('rw', this.database.tables, async () => {
      for (const table of this.database.tables) await table.clear();
      await this.database.accounts.bulkPut(valid.accounts);
      await this.database.transactions.bulkPut(valid.transactions);
      await this.database.categories.bulkPut(valid.categories);
      await this.database.merchants.bulkPut(valid.merchants);
      await this.database.merchantAliases.bulkPut(valid.merchantAliases);
      await this.database.rules.bulkPut(valid.rules);
      await this.database.imports.bulkPut(valid.imports);
      await this.database.budgets.bulkPut(valid.budgets);
      await this.database.subscriptions.bulkPut(valid.subscriptions);
      await this.database.settings.bulkPut(valid.settings);
      await this.database.settings.put({ id: 'initialized', value: 'true' });
    });
  }
  async clear(): Promise<void> {
    await this.replace(emptySnapshot());
  }
  async clearDemo(): Promise<void> {
    await this.database.transaction('rw', this.database.tables, async () => {
      const accounts = await this.database.accounts.toArray();
      for (const account of accounts.filter((account) => account.demo))
        await this.deleteAccount(account.id);
      await this.database.budgets.filter((budget) => budget.demo === true).delete();
    });
  }
  async commitImport(
    accountId: string,
    fileName: string,
    rows: PreviewRow[],
    expectedIds: string[],
  ): Promise<number> {
    return this.database.transaction('rw', this.database.tables, async () => {
      const account = await this.database.accounts.get(accountId);
      if (!account || account.archived) throw new Error('Choose an active account');
      const existing = await this.database.transactions
        .where('accountId')
        .equals(accountId)
        .primaryKeys();
      if ([...existing].sort().join('|') !== [...expectedIds].sort().join('|'))
        throw new Error(
          'Account changed in another tab. Refresh the import preview before saving.',
        );
      const snapshot = await this.read();
      const importId = crypto.randomUUID();
      const selected = rows
        .filter((row) => row.selected && row.transaction && row.status !== 'DUPLICATE')
        .map((row) => row.transaction)
        .filter((transaction): transaction is Transaction => !!transaction);
      if (
        selected.some(
          (transaction) =>
            transaction.accountId !== accountId || transaction.currency !== account.currency,
        )
      )
        throw new Error('Import rows do not belong to the selected account');
      const merchantNames = new Map(
        snapshot.merchants.map((merchant) => [merchant.name, merchant]),
      );
      for (const transaction of selected) {
        const name = normalizeTransactionMerchant(
          transaction,
          snapshot.merchantAliases,
          snapshot.merchants,
        );
        let merchant = merchantNames.get(name);
        if (!merchant) {
          merchant = { id: crypto.randomUUID(), name };
          merchantNames.set(name, merchant);
          snapshot.merchants.push(merchant);
        }
        transaction.merchantId = merchant.id;
      }
      const categorize = createCategorizer({ ...snapshot, history: snapshot.transactions });
      const imported = selected.map((transaction) => ({
        ...transaction,
        importId,
        categoryId: categorize(transaction),
      }));
      const record: ImportRecord = {
        id: importId,
        accountId,
        fileName,
        importedAt: new Date().toISOString(),
        totalRows: rows.length,
        importedRows: imported.length,
        duplicateRows: rows.filter((row) => row.status === 'DUPLICATE').length,
        invalidRows: rows.filter((row) => row.status === 'INVALID').length,
        status: rows.every((row) => row.status === 'INVALID')
          ? 'FAILED'
          : rows.some(
                (row) =>
                  row.status === 'INVALID' ||
                  (row.status === 'POTENTIAL_DUPLICATE' && !row.selected),
              )
            ? 'PARTIAL'
            : 'COMPLETED',
      };
      validateSnapshot({
        ...snapshot,
        transactions: [...snapshot.transactions, ...imported],
        imports: [...snapshot.imports, record],
      });
      await this.database.merchants.bulkPut(snapshot.merchants);
      await this.database.transactions.bulkPut(imported);
      await this.database.imports.put(record);
      return imported.length;
    });
  }
}
export const repository = new IndexedDbFinanceRepository(new FinTrackDatabase());
