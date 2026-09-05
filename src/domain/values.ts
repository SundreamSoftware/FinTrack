const currencies = new Set(Intl.supportedValuesOf('currency'));
export function isCurrency(currency: string): boolean {
  return currencies.has(currency);
}
export function fractionDigits(currency: string): number {
  if (!isCurrency(currency)) throw new Error('Unsupported ISO currency');
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}
export function safeMoney(amount: number): number {
  if (!Number.isSafeInteger(amount)) throw new Error('Amount exceeds supported precision');
  return amount;
}
export function sumMoney(amounts: Iterable<number>): number {
  let total = 0n;
  for (const amount of amounts) total += BigInt(safeMoney(amount));
  return safeMoney(Number(total));
}
export function parseMoney(raw: string, currency = 'PLN'): number {
  const compact = raw.trim().replace(/[\s\u00a0]/g, '');
  if (!/^[+-]?\d+(?:[.,]\d+)*$/.test(compact)) throw new Error('Invalid amount');
  const digits = fractionDigits(currency);
  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    const escapedGrouping = grouping === '.' ? '\\.' : ',';
    const escapedDecimal = decimal === '.' ? '\\.' : ',';
    if (
      !new RegExp(`^[+-]?\\d{1,3}(?:${escapedGrouping}\\d{3})+${escapedDecimal}\\d+$`).test(compact)
    )
      throw new Error('Invalid digit grouping');
    normalized = compact.split(grouping).join('').replace(decimal, '.');
  } else normalized = compact.replace(',', '.');
  if (!new RegExp(`^[+-]?\\d+(?:\\.\\d{1,${Math.max(1, digits)}})?$`).test(normalized))
    throw new Error('Ambiguous or over-precise amount');
  const [whole = '0', fraction = ''] = normalized.replace(/^[+-]/, '').split('.');
  if (fraction.length > digits) throw new Error('Too many decimal places for currency');
  const value = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
  return safeMoney(Number(normalized.startsWith('-') ? -value : value));
}
export function formatMoney(amount: number, currency = 'PLN'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(
    amount / 10 ** fractionDigits(currency),
  );
}
export function moneyInput(amount: number, currency: string): string {
  const digits = fractionDigits(currency);
  const absolute = String(Math.abs(amount)).padStart(digits + 1, '0');
  return `${amount < 0 ? '-' : ''}${digits ? absolute.slice(0, -digits) + '.' + absolute.slice(-digits) : absolute}`;
}
export function percentage(value: number | null): string {
  return value === null
    ? '—'
    : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value) + '%';
}
export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function parseDate(raw: string): string {
  const value = raw.trim();
  if (isDate(value)) return value;
  const match = /^(\d{2})[./-](\d{2})[./-](\d{4})$/.exec(value);
  if (match) {
    const normalized = `${match[3]}-${match[2]}-${match[1]}`;
    if (isDate(normalized)) return normalized;
  }
  throw new Error('Invalid date. Use YYYY-MM-DD or DD.MM.YYYY');
}
export function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function monthOffset(month: string, offset: number): string {
  const date = new Date(month + '-15T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function dayDistance(first: string, second: string): number {
  return Math.round(
    (Date.parse(second + 'T12:00:00Z') - Date.parse(first + 'T12:00:00Z')) / 86400000,
  );
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
export function nextCalendarPayment(
  date: string,
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY',
): string {
  if (frequency === 'WEEKLY') return addDays(date, 7);
  const month = monthOffset(date.slice(0, 7), frequency === 'MONTHLY' ? 1 : 12);
  const day = Math.min(
    Number(date.slice(8)),
    new Date(Date.parse(monthOffset(month, 1) + '-01T12:00:00Z') - 86400000).getUTCDate(),
  );
  return `${month}-${String(day).padStart(2, '0')}`;
}
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date + 'T12:00:00'));
}
export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}
export function metadata(): { id: string; createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}
