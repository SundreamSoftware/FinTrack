import { describe, it, expect } from 'vitest';
import {
  classifyDuplicates,
  createCategorizer,
  normalizeMerchant,
  matchesRule,
  type CategorizationContext,
} from './categorization';
import { transaction } from '../test/fixtures';
import type { CategorizationRule } from './models';
const context: CategorizationContext = {
  rules: [],
  merchants: [],
  merchantAliases: [],
  history: [],
};
const rule: CategorizationRule = {
  id: 'rule',
  operator: 'MERCHANT_CONTAINS',
  value: 'BIEDRONKA',
  categoryId: 'shopping',
  priority: 1,
  enabled: true,
};
describe('categorization priorities', () => {
  it('normalizes merchant store codes', () => {
    expect(normalizeMerchant('BIEDRONKA 4132 KATOWICE')).toBe('BIEDRONKA');
    expect(normalizeMerchant('BIEDRONKA SKLEP 1023')).toBe('BIEDRONKA');
  });
  it('uses user rule before keywords', () =>
    expect(
      createCategorizer({ ...context, rules: [rule] })(
        transaction({ rawDescription: 'BIEDRONKA', normalizedDescription: 'BIEDRONKA' }),
      ),
    ).toBe('shopping'));
  it('uses the lowest priority number first', () =>
    expect(
      createCategorizer({
        ...context,
        rules: [rule, { ...rule, id: 'first', priority: 0, categoryId: 'food' }],
      })(transaction({ rawDescription: 'BIEDRONKA' })),
    ).toBe('food'));
  it('uses merchant mapping before history and keywords', () =>
    expect(
      createCategorizer({
        ...context,
        merchants: [{ id: 'merchant', name: 'BIEDRONKA', categoryId: 'food' }],
      })(transaction({ merchantId: 'merchant' })),
    ).toBe('food'));
  it('learns only explicit manual history', () =>
    expect(
      createCategorizer({
        ...context,
        history: [
          transaction({ merchantId: 'merchant', categoryId: 'travel', manualCategory: true }),
        ],
      })(transaction({ merchantId: 'merchant' })),
    ).toBe('travel'));
  it('uses keyword fallback', () =>
    expect(createCategorizer(context)(transaction({ normalizedDescription: 'NETFLIX' }))).toBe(
      'subscriptions',
    ));
  it('leaves unmatched entries uncategorized', () =>
    expect(createCategorizer(context)(transaction())).toBeUndefined());
  it('does not compare amounts across currencies', () =>
    expect(
      matchesRule(
        transaction({ currency: 'EUR' }),
        { ...rule, operator: 'AMOUNT_LESS', value: '0', currency: 'PLN' },
        'SHOP',
      ),
    ).toBe(false));
  it.each(['MERCHANT_EQUALS', 'DESCRIPTION_CONTAINS', 'COUNTERPARTY_CONTAINS'] as const)(
    'supports %s',
    (operator) =>
      expect(
        matchesRule(
          transaction({ normalizedDescription: 'BIEDRONKA', counterparty: 'BIEDRONKA' }),
          { ...rule, operator },
          'BIEDRONKA',
        ),
      ).toBe(true),
  );
});
describe('duplicate multiplicities', () => {
  it('detects exact reimport', () => {
    const payment = transaction();
    expect(classifyDuplicates([payment], [payment])).toEqual(['DUPLICATE']);
  });
  it('flags similar descriptions as potential only', () =>
    expect(
      classifyDuplicates(
        [transaction({ normalizedDescription: 'TEST SHOP OTHER' })],
        [transaction()],
      ),
    ).toEqual(['POTENTIAL_DUPLICATE']));
  it('preserves two legal identical payments for explicit review', () =>
    expect(classifyDuplicates([transaction(), transaction()], [])).toEqual([
      'NEW',
      'POTENTIAL_DUPLICATE',
    ]));
  it('matches occurrence counts on reimport', () =>
    expect(
      classifyDuplicates(
        [transaction(), transaction(), transaction()],
        [transaction(), transaction()],
      ),
    ).toEqual(['DUPLICATE', 'DUPLICATE', 'POTENTIAL_DUPLICATE']));
  it('isolates accounts', () =>
    expect(classifyDuplicates([transaction({ accountId: 'other' })], [transaction()])).toEqual([
      'NEW',
    ]));
});
