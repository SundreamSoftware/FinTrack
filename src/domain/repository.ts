import type {
  Account,
  Budget,
  CategorizationRule,
  Category,
  Merchant,
  MerchantAlias,
  Snapshot,
  Subscription,
  Transaction,
} from './models';
export interface FinanceRepository {
  read(): Promise<Snapshot>;
  saveAccount(account: Account): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  saveCategory(category: Category): Promise<void>;
  saveMerchant(merchant: Merchant, alias: MerchantAlias): Promise<void>;
  saveBudget(budget: Budget): Promise<void>;
  deleteBudget(id: string): Promise<void>;
  saveRule(rule: CategorizationRule, applyExisting: boolean): Promise<void>;
  deleteRule(id: string): Promise<void>;
  updateTransaction(transaction: Transaction): Promise<void>;
  correctTransaction(
    transaction: Transaction,
    rule: CategorizationRule | undefined,
    applyExisting: boolean,
  ): Promise<void>;
  saveSubscriptions(subscriptions: Subscription[]): Promise<void>;
  setSetting(id: string, value: string): Promise<void>;
  replace(snapshot: Snapshot): Promise<void>;
  clear(): Promise<void>;
}
