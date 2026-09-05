import { describe, it, expect } from 'vitest';
import { parseMoney, sumMoney, parseDate, nextCalendarPayment, monthOffset } from './values';
describe('money precision', () => {
  it.each([
    ['0.1', 10],
    ['0.2', 20],
    ['-12,99', -1299],
    ['1 234,56', 123456],
    ['1,234.56', 123456],
    ['1.234,56', 123456],
    ['+100', 10000],
  ])('parses %s exactly', (raw, expected) => expect(parseMoney(raw)).toBe(expected));
  it('adds cents without floating point drift', () =>
    expect(sumMoney([parseMoney('0.1'), parseMoney('0.2')])).toBe(30));
  it('supports zero and three minor-unit currencies', () => {
    expect(parseMoney('100', 'JPY')).toBe(100);
    expect(parseMoney('1.234', 'KWD')).toBe(1234);
  });
  it.each(['1.2345', '12foo', 'NaN', 'Infinity', '1,2,3', ''])(
    'rejects invalid or ambiguous %s',
    (raw) => expect(() => parseMoney(raw)).toThrow(),
  );
  it('rejects unsafe integers', () => {
    expect(() => parseMoney('900719925474099999')).toThrow();
    expect(() => sumMoney([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
  it('rejects unsupported currency', () => expect(() => parseMoney('1', 'ZZZ')).toThrow());
});
describe('calendar dates', () => {
  it.each([
    ['31.01.2026', '2026-01-31'],
    ['31/01/2026', '2026-01-31'],
    ['2024-02-29', '2024-02-29'],
  ])('parses %s', (raw, expected) => expect(parseDate(raw)).toBe(expected));
  it.each(['2026-02-29', '31.02.2026', '2026-13-01', '01/31/2026'])('rejects %s', (raw) =>
    expect(() => parseDate(raw)).toThrow(),
  );
  it('handles month boundaries', () => {
    expect(nextCalendarPayment('2026-01-31', 'MONTHLY')).toBe('2026-02-28');
    expect(nextCalendarPayment('2024-02-29', 'YEARLY')).toBe('2025-02-28');
    expect(monthOffset('2026-01', -1)).toBe('2025-12');
  });
});
