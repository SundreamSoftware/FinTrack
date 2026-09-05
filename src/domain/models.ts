import { z } from 'zod';
import { isDate, isCurrency } from './values';
const id = z.string().min(1).max(200);
const text = z.string().max(4000);
const timestamp = z.iso.datetime();
export const moneySchema = z.number().int().safe();
export const currencySchema = z.string().refine(isCurrency, 'Use a supported ISO 4217 currency');
export const dateSchema = z.string().refine(isDate, 'Use a valid calendar date');
const metadata = { id, createdAt: timestamp, updatedAt: timestamp };
export const accountTypes = ['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH', 'OTHER'] as const;
export const transactionTypes = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'REFUND',
  'FEE',
  'CASH_WITHDRAWAL',
  'OTHER',
] as const;
export const accountSchema = z.object({
  ...metadata,
  name: z.string().trim().min(1).max(100),
  type: z.enum(accountTypes),
  institutionName: text,
  currency: currencySchema,
  initialBalance: moneySchema,
  archived: z.boolean(),
  demo: z.boolean().default(false),
});
export const categorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
});
export const merchantSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  categoryId: id.optional(),
});
export const aliasSchema = z.object({ id, merchantId: id, pattern: z.string().min(1).max(200) });
export const ruleOperators = [
  'MERCHANT_CONTAINS',
  'MERCHANT_EQUALS',
  'DESCRIPTION_CONTAINS',
  'COUNTERPARTY_CONTAINS',
  'AMOUNT_GREATER',
  'AMOUNT_LESS',
] as const;
export const ruleSchema = z
  .object({
    id,
    operator: z.enum(ruleOperators),
    value: z.string().min(1).max(200),
    categoryId: id,
    priority: z.number().int().min(0).max(9999),
    enabled: z.boolean(),
    currency: currencySchema.optional(),
  })
  .superRefine((rule, context) => {
    if (
      rule.operator.startsWith('AMOUNT_') &&
      (!rule.currency || !/^-?\d+$/.test(rule.value) || !Number.isSafeInteger(Number(rule.value)))
    )
      context.addIssue({
        code: 'custom',
        message: 'Amount rules need a currency and an integer minor-unit value',
      });
  });
export const transactionSchema = z.object({
  ...metadata,
  accountId: id,
  transactionDate: dateSchema,
  bookingDate: dateSchema.optional(),
  amount: moneySchema,
  currency: currencySchema,
  rawDescription: text,
  normalizedDescription: text,
  merchantId: id.optional(),
  counterparty: text.optional(),
  counterpartyAccount: text.optional(),
  title: text.optional(),
  balanceAfterTransaction: moneySchema.optional(),
  categoryId: id.optional(),
  type: z.enum(transactionTypes),
  source: z.enum(['CSV', 'DEMO']),
  importId: id.optional(),
  fingerprint: z.string().min(1).max(16000),
  recurringStatus: z.enum(['NONE', 'DETECTED', 'CONFIRMED', 'REJECTED', 'INACTIVE']),
  note: text.optional(),
  manualCategory: z.boolean().default(false),
});
export const importSchema = z.object({
  id,
  accountId: id,
  fileName: z.string().max(255),
  importedAt: timestamp,
  totalRows: z.number().int().nonnegative(),
  importedRows: z.number().int().nonnegative(),
  duplicateRows: z.number().int().nonnegative(),
  invalidRows: z.number().int().nonnegative(),
  status: z.enum(['COMPLETED', 'PARTIAL', 'FAILED']),
});
export const budgetSchema = z.object({
  ...metadata,
  categoryId: id,
  amount: moneySchema.nonnegative(),
  currency: currencySchema,
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  recurrence: z.enum(['MONTHLY', 'ONCE']),
});
export const subscriptionSchema = z.object({
  id,
  key: z.string().max(500),
  merchantName: z.string().max(200),
  merchantId: id.optional(),
  accountId: id,
  currency: currencySchema,
  amount: moneySchema.nonnegative(),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']),
  nextPayment: dateSchema,
  confidence: z.number().min(0).max(1),
  occurrences: z.number().int().min(3),
  status: z.enum(['DETECTED', 'CONFIRMED', 'REJECTED', 'INACTIVE']),
  transactionIds: z.array(id).max(100000),
  signature: z.string().max(500),
});
export const settingSchema = z.object({ id, value: z.string().max(1000) });
export type Account = z.infer<typeof accountSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Merchant = z.infer<typeof merchantSchema>;
export type MerchantAlias = z.infer<typeof aliasSchema>;
export type CategorizationRule = z.infer<typeof ruleSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Subscription = z.infer<typeof subscriptionSchema>;
export type ImportRecord = z.infer<typeof importSchema>;
export type Setting = z.infer<typeof settingSchema>;
export interface Snapshot {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  merchants: Merchant[];
  merchantAliases: MerchantAlias[];
  rules: CategorizationRule[];
  imports: ImportRecord[];
  budgets: Budget[];
  subscriptions: Subscription[];
  settings: Setting[];
}
export const defaultCategories: Category[] = [
  'Housing',
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Education',
  'Travel',
  'Subscriptions',
  'Taxes',
  'Salary',
  'Investments',
  'Fees',
  'Transfers',
  'Other',
  'Groceries',
  'Restaurants',
  'Delivery',
].map((name, index) => ({
  id: name.toLowerCase(),
  name,
  color: ['#276f65', '#315ca8', '#a65c18', '#7848a1', '#ac394f'][index % 5] ?? '#276f65',
}));
export const emptySnapshot = (): Snapshot => ({
  accounts: [],
  transactions: [],
  categories: defaultCategories,
  merchants: [],
  merchantAliases: [],
  rules: [],
  imports: [],
  budgets: [],
  subscriptions: [],
  settings: [],
});
