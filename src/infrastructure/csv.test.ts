import { describe, it, expect } from 'vitest';
import { GenericCsvImporter, previewImport } from './csv';
import { account, transaction } from '../test/fixtures';
const importer = new GenericCsvImporter();
describe('generic CSV pipeline', () => {
  it.each([',', ';', '\t'])('supports delimiter %s', (delimiter) => {
    const csv = importer.parse(
      ['date', 'amount', 'description'].join(delimiter) +
        '\n' +
        ['2026-01-15', '-12.99', 'SHOP'].join(delimiter),
    );
    expect(
      previewImport(csv, importer.detectMapping(csv.headers), account, [])[0]?.transaction?.amount,
    ).toBe(-1299);
  });
  it('handles BOM, decimal commas, quoting and empty columns', () => {
    const csv = importer.parse(
      '\uFEFFData operacji;Kwota;Opis transakcji;Waluta;Nazwa kontrahenta\n15.01.2026;"-1 234,56";"SHOP; branch";PLN;\n',
    );
    const row = previewImport(csv, importer.detectMapping(csv.headers), account, [])[0];
    expect(row?.transaction?.amount).toBe(-123456);
    expect(row?.transaction?.rawDescription).toBe('SHOP; branch');
  });
  it('handles embedded newlines in quoted descriptions', () => {
    const csv = importer.parse('date,amount,description\n2026-01-15,-1,"SHOP\nBRANCH"');
    expect(csv.rows).toHaveLength(1);
  });
  it('rejects malformed CSV', () =>
    expect(() => importer.parse('date,amount,description\n2026-01-15,-1,"unclosed')).toThrow());
  it('rejects missing mapping', () => {
    const csv = importer.parse('date,description\n2026-01-15,SHOP');
    expect(() => previewImport(csv, importer.detectMapping(csv.headers), account, [])).toThrow(
      'Map',
    );
  });
  it('marks invalid dates and mixed currencies before persistence', () => {
    const csv = importer.parse(
      'date,amount,description,currency\n2026-02-30,-1,SHOP,PLN\n2026-01-01,-1,SHOP,EUR',
    );
    expect(
      previewImport(csv, importer.detectMapping(csv.headers), account, []).every(
        (row) => row.status === 'INVALID',
      ),
    ).toBe(true);
  });
  it('marks exact existing duplicates', () => {
    const csv = importer.parse('date,amount,description\n2026-01-15,-100,TEST SHOP');
    expect(
      previewImport(csv, importer.detectMapping(csv.headers), account, [transaction()])[0]?.status,
    ).toBe('DUPLICATE');
  });
});
