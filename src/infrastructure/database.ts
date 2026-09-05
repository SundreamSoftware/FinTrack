import Dexie, { type EntityTable } from 'dexie';
import type {
  Account,
  Budget,
  CategorizationRule,
  Category,
  ImportRecord,
  Merchant,
  MerchantAlias,
  Setting,
  Subscription,
  Transaction,
} from '../domain/models';
export class FinTrackDatabase extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  merchants!: EntityTable<Merchant, 'id'>;
  merchantAliases!: EntityTable<MerchantAlias, 'id'>;
  rules!: EntityTable<CategorizationRule, 'id'>;
  imports!: EntityTable<ImportRecord, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  subscriptions!: EntityTable<Subscription, 'id'>;
  settings!: EntityTable<Setting, 'id'>;
  constructor(name = 'FinTrack') {
    super(name);
    this.version(1).stores({
      accounts: 'id,currency,archived',
      transactions:
        'id,accountId,transactionDate,[accountId+transactionDate],[currency+transactionDate],categoryId,merchantId,fingerprint,importId',
      categories: 'id,name',
      merchants: 'id,name',
      merchantAliases: 'id,merchantId',
      rules: 'id,priority',
      imports: 'id,accountId,importedAt',
      budgets: 'id,[currency+month],categoryId',
      subscriptions: 'id,key,accountId,status',
      settings: 'id',
    });
  }
}
