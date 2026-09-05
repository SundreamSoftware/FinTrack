import Papa from 'papaparse';
import type { Account, Transaction } from '../domain/models';
import { transactionSchema } from '../domain/models';
import { metadata, normalizeText, parseDate, parseMoney } from '../domain/values';
import { classifyDuplicates, fingerprint, type DuplicateStatus } from '../domain/categorization';
export const MAX_CSV_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 100000;
export const csvFields = [
  'transactionDate',
  'bookingDate',
  'amount',
  'currency',
  'description',
  'counterparty',
  'counterpartyAccount',
  'title',
  'balanceAfterTransaction',
] as const;
export type CsvField = (typeof csvFields)[number];
export type ColumnMapping = Partial<Record<CsvField, string>>;
export interface CsvDocument {
  headers: string[];
  rows: Record<string, string>[];
}
export interface PreviewRow {
  row: number;
  transaction?: Transaction;
  error?: string;
  status: DuplicateStatus | 'INVALID';
  selected: boolean;
}
export interface CsvImportStrategy {
  parse(content: string): CsvDocument;
  detectMapping(headers: string[]): ColumnMapping;
}
const headerAliases: Record<CsvField, string[]> = {
  transactionDate: ['date', 'transactiondate', 'data operacji', 'data transakcji'],
  bookingDate: ['bookingdate', 'data ksiegowania'],
  amount: ['amount', 'kwota'],
  currency: ['currency', 'waluta'],
  description: ['description', 'opis', 'opis transakcji'],
  counterparty: ['counterparty', 'merchant', 'nazwa kontrahenta'],
  counterpartyAccount: ['counterpartyaccount', 'rachunek kontrahenta'],
  title: ['title', 'tytul'],
  balanceAfterTransaction: ['balance', 'saldo'],
};
export class GenericCsvImporter implements CsvImportStrategy {
  parse(content: string): CsvDocument {
    if (new TextEncoder().encode(content).length > MAX_CSV_BYTES)
      throw new Error('CSV exceeds the 10 MB limit');
    const parsed = Papa.parse<Record<string, string>>(content.replace(/^\uFEFF/, ''), {
      header: true,
      skipEmptyLines: 'greedy',
      delimitersToGuess: [',', ';', '\t'],
      transformHeader: (header) => header.trim(),
    });
    if (parsed.errors.length)
      throw new Error(
        'CSV could not be parsed. Check quotes, delimiter and the number of columns.',
      );
    const headers = parsed.meta.fields ?? [];
    if (headers.length < 2 || !parsed.data.length)
      throw new Error('CSV needs a header and at least one transaction');
    if (parsed.data.length > MAX_CSV_ROWS) throw new Error('CSV exceeds 100,000 rows');
    if (
      new Set(headers).size !== headers.length ||
      (parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length)
    )
      throw new Error('CSV column names must be unique');
    return { headers, rows: parsed.data };
  }
  detectMapping(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {};
    for (const field of csvFields) {
      const header = headers.find((header) =>
        headerAliases[field].some((alias) => normalizeText(alias) === normalizeText(header)),
      );
      if (header) mapping[field] = header;
    }
    return mapping;
  }
}
export function previewImport(
  document: CsvDocument,
  mapping: ColumnMapping,
  account: Account,
  existing: Transaction[],
): PreviewRow[] {
  if (!mapping.transactionDate || !mapping.amount || (!mapping.description && !mapping.title))
    throw new Error('Map transaction date, amount, and description or title');
  const selectedColumns = Object.values(mapping).filter(Boolean);
  if (new Set(selectedColumns).size !== selectedColumns.length)
    throw new Error('Assign each CSV column only once');
  const preview = document.rows.map((row, index): PreviewRow => {
    try {
      const field = (name: CsvField) => row[mapping[name] ?? '']?.trim() ?? '';
      const currency = field('currency') || account.currency;
      if (currency !== account.currency) throw new Error('Currency differs from account currency');
      const amount = parseMoney(field('amount'), currency);
      const description = field('description') || field('title');
      if (!description) throw new Error('Description is empty');
      const transaction: Transaction = {
        ...metadata(),
        accountId: account.id,
        transactionDate: parseDate(field('transactionDate')),
        bookingDate: field('bookingDate') ? parseDate(field('bookingDate')) : undefined,
        amount,
        currency,
        rawDescription: description,
        normalizedDescription: normalizeText(description),
        counterparty: field('counterparty') || undefined,
        counterpartyAccount: field('counterpartyAccount') || undefined,
        title: field('title') || undefined,
        balanceAfterTransaction: field('balanceAfterTransaction')
          ? parseMoney(field('balanceAfterTransaction'), currency)
          : undefined,
        type: amount > 0 ? 'INCOME' : 'EXPENSE',
        source: 'CSV',
        fingerprint: 'pending',
        recurringStatus: 'NONE',
        manualCategory: false,
      };
      transaction.fingerprint = fingerprint(transaction);
      transactionSchema.parse(transaction);
      return { row: index + 2, transaction, status: 'NEW', selected: true };
    } catch (error) {
      return {
        row: index + 2,
        error: error instanceof Error ? error.message : 'Invalid row',
        status: 'INVALID',
        selected: false,
      };
    }
  });
  const valid = preview.filter(
    (row): row is PreviewRow & { transaction: Transaction } => !!row.transaction,
  );
  const statuses = classifyDuplicates(
    valid.map((row) => row.transaction),
    existing,
  );
  valid.forEach((row, index) => {
    row.status = statuses[index] ?? 'NEW';
    row.selected = row.status === 'NEW';
  });
  return preview;
}
