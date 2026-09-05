import { describe, it, expect } from 'vitest';
import { budgetUsage, cashFlow, categoryTotals, forecastSavings, monthlySeries } from './analytics';
import { metadata } from './values';
import { transaction } from '../test/fixtures';
import type { Budget } from './models';
const budget: Budget = {
  ...metadata(),
  categoryId: 'food',
  amount: 10000,
  currency: 'PLN',
  month: '2026-01',
  recurrence: 'MONTHLY',
};
describe('cash flow', () => {
  it('separates income, expenses, refunds and transfers', () => {
    const flow = cashFlow(
      [
        transaction({ amount: 100000, type: 'INCOME' }),
        transaction({ amount: -20000 }),
        transaction({ amount: 5000, type: 'REFUND' }),
        transaction({ amount: 999999, type: 'TRANSFER' }),
        transaction({ amount: -999999, type: 'TRANSFER' }),
        transaction({ currency: 'EUR', amount: 100000, type: 'INCOME' }),
      ],
      'PLN',
    );
    expect(flow).toMatchObject({ income: 100000, expenses: 15000, net: 85000, savingsRate: 85 });
  });
  it('handles zero income without NaN', () =>
    expect(cashFlow([transaction()], 'PLN').savingsRate).toBeNull());
  it('nets category refunds', () =>
    expect(
      categoryTotals(
        [
          transaction({ categoryId: 'food' }),
          transaction({ categoryId: 'food', type: 'REFUND', amount: 1000 }),
        ],
        'PLN',
        '2026-01',
      ).get('food'),
    ).toBe(9000));
  it('fills missing months', () =>
    expect(
      monthlySeries([transaction()], 'PLN', 3, '2026-03').map((flow) => flow.expenses),
    ).toEqual([10000, 0, 0]));
});
describe('budgets', () => {
  it.each([
    [7900, 'OK'],
    [8000, 'WARNING'],
    [9900, 'WARNING'],
    [10000, 'EXCEEDED'],
    [12000, 'EXCEEDED'],
  ] as const)('classifies spend %s', (spent, status) =>
    expect(budgetUsage(budget, spent).status).toBe(status),
  );
  it('handles zero budget explicitly', () => {
    expect(budgetUsage({ ...budget, amount: 0 }, 0)).toMatchObject({ usage: 0, status: 'OK' });
    expect(budgetUsage({ ...budget, amount: 0 }, 1)).toMatchObject({
      usage: 100,
      status: 'EXCEEDED',
    });
  });
});
describe('forecast', () => {
  const stable = [1, 2, 3, 4, 5, 6].flatMap((month) => [
    transaction({ transactionDate: `2026-0${month}-01`, amount: 100000, type: 'INCOME' }),
    transaction({ transactionDate: `2026-0${month}-02`, amount: -40000 }),
  ]);
  it('predicts stable savings in integer minor units', () => {
    const forecast = forecastSavings(stable, [], 'PLN', 3, '2026-07');
    expect(forecast.expectedMonthlySavings).toBe(60000);
    expect(forecast.points.at(-1)?.expected).toBe(180000);
  });
  it('excludes the current incomplete month', () =>
    expect(
      forecastSavings(
        [...stable, transaction({ transactionDate: '2026-07-01', amount: 9999999 })],
        [],
        'PLN',
        1,
        '2026-07',
      ).expectedMonthlySavings,
    ).toBe(60000));
  it('widens estimates for high variance', () => {
    const varied = stable.map((payment, index) => ({
      ...payment,
      amount: payment.amount + (index % 4 === 0 ? 200000 : 0),
    }));
    const narrow = forecastSavings(stable, [], 'PLN', 6, '2026-07').points.at(-1);
    const wide = forecastSavings(varied, [], 'PLN', 6, '2026-07').points.at(-1);
    expect((wide?.upper ?? 0) - (wide?.lower ?? 0)).toBeGreaterThan(
      (narrow?.upper ?? 0) - (narrow?.lower ?? 0),
    );
  });
  it('reports no history', () => expect(forecastSavings([], [], 'PLN', 1).historyMonths).toBe(0));
  it('handles expenses with zero income', () =>
    expect(forecastSavings([transaction()], [], 'PLN', 1, '2026-02').expectedMonthlySavings).toBe(
      -10000,
    ));
});

describe('large transaction histories', () => {
  it('calculates 50,000 transactions without precision loss', () => {
    const history = Array.from({ length: 50000 }, (_, index) =>
      transaction({
        id: `payment-${index}`,
        amount: index % 2 === 0 ? 101 : -100,
        type: index % 2 === 0 ? 'INCOME' : 'EXPENSE',
      }),
    );
    const flow = cashFlow(history, 'PLN');
    expect(flow).toMatchObject({ income: 2525000, expenses: 2500000, net: 25000 });
    expect(monthlySeries(history, 'PLN', 12, '2026-12')[0]?.net).toBe(25000);
  });
});
