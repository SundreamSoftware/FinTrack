import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { FinTrackDatabase } from './database';
import { IndexedDbFinanceRepository } from './repository';
import { GenericCsvImporter, previewImport } from './csv';
import { parseBackup, serializeBackup } from './backup';
import { account, transaction, snapshot } from '../test/fixtures';
let database: FinTrackDatabase;
let repository: IndexedDbFinanceRepository;
beforeEach(async () => {
  database = new FinTrackDatabase(crypto.randomUUID());
  repository = new IndexedDbFinanceRepository(database);
  await repository.initialize();
  await repository.saveAccount(account);
});
afterEach(async () => {
  await database.delete();
});
describe('IndexedDB integration', () => {
  it('saves, reads, updates and deletes account history', async () => {
    await database.transactions.put(transaction({ id: 'payment' }));
    expect((await repository.read()).transactions).toHaveLength(1);
    const payment = await database.transactions.get('payment');
    if (!payment) throw new Error('Missing fixture');
    await repository.updateTransaction({ ...payment, note: 'Reviewed' });
    expect((await database.transactions.get('payment'))?.note).toBe('Reviewed');
    await repository.deleteAccount(account.id);
    expect((await repository.read()).transactions).toHaveLength(0);
    expect((await repository.read()).accounts).toHaveLength(0);
  });
  it('runs CSV → normalization → deduplication → categorization → persistence', async () => {
    const importer = new GenericCsvImporter();
    const csv = importer.parse('date;amount;description\n2026-01-15;-12,99;BIEDRONKA 512');
    const preview = previewImport(csv, importer.detectMapping(csv.headers), account, []);
    expect((await repository.read()).transactions).toHaveLength(0);
    expect(await repository.commitImport(account.id, 'fictional.csv', preview, [])).toBe(1);
    const stored = await repository.read();
    expect(stored.transactions[0]).toMatchObject({ amount: -1299, categoryId: 'groceries' });
    const repeated = previewImport(
      csv,
      importer.detectMapping(csv.headers),
      account,
      stored.transactions,
    );
    expect(repeated[0]?.status).toBe('DUPLICATE');
    expect(
      await repository.commitImport(
        account.id,
        'fictional.csv',
        repeated,
        stored.transactions.map((payment) => payment.id),
      ),
    ).toBe(0);
    expect((await repository.read()).transactions).toHaveLength(1);
  });
  it('rejects stale import previews from another tab', async () => {
    await database.transactions.put(transaction());
    await expect(repository.commitImport(account.id, 'file.csv', [], [])).rejects.toThrow(
      'another tab',
    );
  });
  it('rolls back invalid restore without deleting existing data', async () => {
    const invalid = { ...snapshot(), transactions: [transaction({ accountId: 'missing' })] };
    await expect(repository.replace(invalid)).rejects.toThrow();
    expect((await repository.read()).accounts).toHaveLength(1);
  });
  it('round trips a versioned backup', async () => {
    await database.transactions.put(transaction());
    const before = await repository.read();
    const json = serializeBackup(before);
    await repository.clear();
    await repository.replace(parseBackup(json));
    expect((await repository.read()).transactions).toEqual(before.transactions);
  });
  it('prevents currency change with history', async () => {
    await database.transactions.put(transaction());
    await expect(repository.saveAccount({ ...account, currency: 'EUR' })).rejects.toThrow(
      'Currency cannot change',
    );
  });
  it('validates malicious and unsupported backup structures', () => {
    expect(() => parseBackup('{"formatVersion":99}')).toThrow();
    expect(() =>
      parseBackup(serializeBackup({ ...snapshot(), transactions: [transaction({ amount: 0.1 })] })),
    ).toThrow();
  });
  it('rejects duplicate record IDs', () =>
    expect(() =>
      parseBackup(serializeBackup({ ...snapshot(), accounts: [account, account] })),
    ).toThrow('duplicate IDs'));
});
