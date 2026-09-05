import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GenericCsvImporter,
  MAX_CSV_BYTES,
  csvFields,
  previewImport,
  type ColumnMapping,
  type CsvDocument,
  type PreviewRow,
} from '../infrastructure/csv';
import { createCategorizer } from '../domain/categorization';
import { repository } from '../infrastructure/repository';
import { formatMoney } from '../domain/values';
import { useAction, useSnapshot } from '../shared/hooks';
import { Feedback, Field, Loading, PageHeader, Panel, Stat, TableWrap } from '../shared/components';
const importer = new GenericCsvImporter();
const PREVIEW_PAGE_SIZE = 50;
export default function Imports() {
  const snapshot = useSnapshot();
  const action = useAction();
  const [accountId, setAccountId] = useState('');
  const [fileName, setFileName] = useState('');
  const [document, setDocument] = useState<CsvDocument>();
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<PreviewRow[]>();
  const [expectedIds, setExpectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [importedCount, setImportedCount] = useState<number>();
  if (!snapshot) return <Loading />;
  const accounts = snapshot.accounts.filter((account) => !account.archived);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const prepare = () => {
    if (!document || !selectedAccount) return;
    const existing = snapshot.transactions.filter(
      (transaction) => transaction.accountId === accountId,
    );
    const previewRows = previewImport(document, mapping, selectedAccount, existing);
    const categorize = createCategorizer({ ...snapshot, history: snapshot.transactions });
    for (const row of previewRows)
      if (row.transaction) row.transaction.categoryId = categorize(row.transaction);
    setExpectedIds(existing.map((transaction) => transaction.id));
    setPreview(previewRows);
    setPage(0);
  };
  return (
    <>
      <PageHeader
        title="Import transactions"
        description="Read your bank export locally. Review every change before saving."
      />
      <Feedback {...action} />
      {!accounts.length ? (
        <Panel title="Create an account first">
          <p>Each import belongs to one account and one currency.</p>
          <Link className="button" to="/accounts">
            Create account
          </Link>
        </Panel>
      ) : (
        <>
          <Panel title="1. Select your account and CSV">
            <div className="form-grid">
              <Field label="Import account">
                <select
                  value={accountId}
                  onChange={(event) => {
                    setAccountId(event.target.value);
                    setPreview(undefined);
                    setImportedCount(undefined);
                  }}
                >
                  <option value="">Choose an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.currency}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="CSV file">
                <input
                  type="file"
                  accept=".csv,.tsv,text/csv,text/tab-separated-values"
                  disabled={action.busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setPreview(undefined);
                    setDocument(undefined);
                    setImportedCount(undefined);
                    if (file)
                      void action.run(async () => {
                        if (file.size > MAX_CSV_BYTES)
                          throw new Error('CSV exceeds the 10 MB limit');
                        const parsed = importer.parse(await file.text());
                        setDocument(parsed);
                        setMapping(importer.detectMapping(parsed.headers));
                        setFileName(file.name);
                      }, 'CSV read locally. Review column mapping.');
                  }}
                />
              </Field>
            </div>
            <p className="muted">
              UTF-8 (with or without BOM) · comma, semicolon or tab · up to 10 MB / 100,000 rows.
              Amounts are signed: expenses negative, income positive.
            </p>
            <p>
              <a href={`${import.meta.env.BASE_URL}examples/generic-pl.csv`} download>
                Download a fictional sample CSV
              </a>
            </p>
          </Panel>
          {document && (
            <Panel title="2. Map columns">
              <div className="form-grid">
                {csvFields.map((field) => (
                  <Field key={field} label={field}>
                    <select
                      value={mapping[field] ?? ''}
                      onChange={(event) => {
                        setMapping({ ...mapping, [field]: event.target.value || undefined });
                        setPreview(undefined);
                      }}
                    >
                      <option value="">
                        {field === 'currency' ? 'Use account currency' : 'Not mapped'}
                      </option>
                      {document.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <p className="muted">
                Required: transactionDate, amount, description or title. Dates: YYYY-MM-DD or
                DD.MM.YYYY. One column per field.
              </p>
              <button
                disabled={!selectedAccount || action.busy}
                onClick={() =>
                  action.run(async () => prepare(), 'Preview ready. Nothing has been saved.')
                }
              >
                Preview import
              </button>
            </Panel>
          )}
          {preview && (
            <Panel title="3. Review and confirm">
              <div className="stats import-stats">
                {[
                  ['Rows detected', preview.length],
                  ['Valid transactions', preview.filter((row) => row.transaction).length],
                  ['New transactions', preview.filter((row) => row.status === 'NEW').length],
                  ['Duplicates', preview.filter((row) => row.status === 'DUPLICATE').length],
                  [
                    'Potential duplicates',
                    preview.filter((row) => row.status === 'POTENTIAL_DUPLICATE').length,
                  ],
                  ['Invalid rows', preview.filter((row) => row.status === 'INVALID').length],
                ].map(([label, value]) => (
                  <Stat key={String(label)} label={String(label)} value={String(value)} />
                ))}
              </div>
              <p>
                Exact matches are skipped. Potential duplicates are unchecked: select them only if
                they represent separate, legitimate payments.
              </p>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Include</th>
                      <th>Row</th>
                      <th>Date</th>
                      <th>Description / issue</th>
                      <th>Amount</th>
                      <th>Category</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview
                      .slice(page * PREVIEW_PAGE_SIZE, (page + 1) * PREVIEW_PAGE_SIZE)
                      .map((row) => (
                        <tr key={row.row}>
                          <td>
                            <input
                              aria-label={`Include row ${row.row}`}
                              type="checkbox"
                              checked={row.selected}
                              disabled={row.status === 'DUPLICATE' || row.status === 'INVALID'}
                              onChange={(event) =>
                                setPreview(
                                  preview.map((current) =>
                                    current.row === row.row
                                      ? { ...current, selected: event.target.checked }
                                      : current,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td>{row.row}</td>
                          <td>{row.transaction?.transactionDate ?? '—'}</td>
                          <td>{row.transaction?.rawDescription ?? row.error}</td>
                          <td>
                            {row.transaction
                              ? formatMoney(row.transaction.amount, row.transaction.currency)
                              : '—'}
                          </td>
                          <td>
                            {snapshot.categories.find(
                              (category) => category.id === row.transaction?.categoryId,
                            )?.name ?? 'Uncategorized'}
                          </td>
                          <td>
                            <span className="status">{row.status}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </TableWrap>
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous preview page
                </button>
                <span>
                  Page {page + 1} of {Math.ceil(preview.length / PREVIEW_PAGE_SIZE)}
                </span>
                <button
                  className="secondary"
                  disabled={(page + 1) * PREVIEW_PAGE_SIZE >= preview.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next preview page
                </button>
              </div>
              <button
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    const count = await repository.commitImport(
                      accountId,
                      fileName,
                      preview,
                      expectedIds,
                    );
                    setImportedCount(count);
                    setPreview(undefined);
                    setDocument(undefined);
                  }, 'Import completed')
                }
              >
                Confirm import ({preview.filter((row) => row.selected).length})
              </button>
            </Panel>
          )}
          {importedCount !== undefined && (
            <p role="status">
              {importedCount} transactions imported.{' '}
              <Link to="/transactions">View transactions</Link> · <Link to="/">Open dashboard</Link>
            </p>
          )}
        </>
      )}
      <Panel title="Import history">
        {!snapshot.imports.length ? (
          <p className="muted">Your confirmed imports will appear here.</p>
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Date</th>
                  <th>Imported / total</th>
                  <th>Duplicates</th>
                  <th>Invalid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...snapshot.imports]
                  .sort((first, second) => second.importedAt.localeCompare(first.importedAt))
                  .map((record) => (
                    <tr key={record.id}>
                      <td>{record.fileName}</td>
                      <td>{new Date(record.importedAt).toLocaleDateString('en-GB')}</td>
                      <td>
                        {record.importedRows} / {record.totalRows}
                      </td>
                      <td>{record.duplicateRows}</td>
                      <td>{record.invalidRows}</td>
                      <td>{record.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
