import { describe, it, expect } from 'vitest';
import { detectSubscriptions } from './subscriptions';
import { transaction } from '../test/fixtures';
const payments = (dates: string[], amounts: number[] = []) =>
  dates.map((date, index) =>
    transaction({
      transactionDate: date,
      amount: amounts[index] ?? -4990,
      rawDescription: 'NETFLIX',
      normalizedDescription: 'NETFLIX',
    }),
  );
describe('subscription detector', () => {
  it('detects monthly payments', () => {
    const detected = detectSubscriptions(
      payments(['2026-01-15', '2026-02-15', '2026-03-15']),
      [],
      [],
      '2026-03-20',
    );
    expect(detected[0]).toMatchObject({
      frequency: 'MONTHLY',
      amount: 4990,
      occurrences: 3,
      nextPayment: '2026-04-15',
      status: 'DETECTED',
    });
  });
  it('allows varying monthly amounts', () =>
    expect(
      detectSubscriptions(
        payments(['2026-01-15', '2026-02-15', '2026-03-15'], [-4900, -5000, -5100]),
        [],
        [],
      ),
    ).toHaveLength(1));
  it('allows one missed month', () =>
    expect(
      detectSubscriptions(payments(['2026-01-15', '2026-02-15', '2026-04-15']), [], []),
    ).toHaveLength(1));
  it('rejects random intervals', () =>
    expect(
      detectSubscriptions(payments(['2026-01-01', '2026-01-03', '2026-02-20']), [], []),
    ).toHaveLength(0));
  it('requires three occurrences', () =>
    expect(detectSubscriptions(payments(['2026-01-15', '2026-02-15']), [], [])).toHaveLength(0));
  it('retains rejected candidates after another occurrence', () => {
    const previous = detectSubscriptions(
      payments(['2026-01-15', '2026-02-15', '2026-03-15']),
      [],
      [],
    ).map((candidate) => ({ ...candidate, status: 'REJECTED' as const }));
    expect(
      detectSubscriptions(
        payments(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']),
        [],
        previous,
      )[0]?.status,
    ).toBe('REJECTED');
  });
  it('does not mix accounts or currencies', () => {
    const history = payments(['2026-01-15', '2026-02-15', '2026-03-15']).map((payment, index) => ({
      ...payment,
      accountId: String(index),
    }));
    expect(detectSubscriptions(history, [], [])).toHaveLength(0);
  });
  it('does not classify transfers as recurring expenses', () =>
    expect(
      detectSubscriptions(
        payments(['2026-01-15', '2026-02-15', '2026-03-15']).map((payment) => ({
          ...payment,
          type: 'TRANSFER',
        })),
        [],
        [],
      ),
    ).toHaveLength(0));
});
