import { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { transactionTypes, type Transaction } from '../domain/models';
import { filterTransactions, type TransactionFilters } from '../domain/filters';
import { formatDate, formatMoney, monthOffset } from '../domain/values';
import { useSnapshot } from '../shared/hooks';
import { EmptyState, Field, Loading, PageHeader, TableWrap } from '../shared/components';
import TransactionEditor from './TransactionEditor';
const PAGE_SIZE = 50;
export default function Transactions() {
  const snapshot = useSnapshot();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    search: '',
    from: params.get('month') ? params.get('month') + '-01' : '',
    to: params.get('month')
      ? new Date(Date.parse(monthOffset(params.get('month') ?? '', 1) + '-01T12:00:00Z') - 86400000)
          .toISOString()
          .slice(0, 10)
      : '',
    account: '',
    category: params.get('category') ?? '',
    merchant: '',
    type: '',
    currency: params.get('currency') ?? '',
    direction: '',
    minimum: '',
    maximum: '',
    recurring: '',
    sort: 'DATE_DESC',
  }));
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Transaction>();
  const filtered = useMemo(() => {
    try {
      return { transactions: filterTransactions(snapshot?.transactions ?? [], filters), error: '' };
    } catch {
      return { transactions: [], error: 'Enter valid amount limits and select their currency.' };
    }
  }, [snapshot, filters]);
  const change = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'currency' ? { minimum: '', maximum: '' } : {}),
    }));
    setPage(0);
  };
  if (!snapshot) return <Loading />;
  const pageCount = Math.max(1, Math.ceil(filtered.transactions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Explore your history and keep every transaction in the right category."
      >
        <Link className="button" to="/import">
          Import CSV
        </Link>
      </PageHeader>
      {editing && (
        <TransactionEditor
          key={editing.id}
          transaction={editing}
          categories={snapshot.categories}
          merchants={snapshot.merchants}
          onClose={() => setEditing(undefined)}
        />
      )}
      <div className="filters">
        <Field label="Search transactions">
          <input
            type="search"
            placeholder="Description, counterparty or note"
            value={filters.search}
            onChange={(event) => change('search', event.target.value)}
          />
        </Field>
        <Field label="From date">
          <input
            type="date"
            value={filters.from}
            onChange={(event) => change('from', event.target.value)}
          />
        </Field>
        <Field label="To date">
          <input
            type="date"
            value={filters.to}
            onChange={(event) => change('to', event.target.value)}
          />
        </Field>
        <Field label="Account">
          <select
            value={filters.account}
            onChange={(event) => change('account', event.target.value)}
          >
            <option value="">All accounts</option>
            {snapshot.accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select
            value={filters.category}
            onChange={(event) => change('category', event.target.value)}
          >
            <option value="">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {snapshot.categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select
            value={filters.currency}
            onChange={(event) => change('currency', event.target.value)}
          >
            <option value="">All currencies</option>
            {[...new Set(snapshot.accounts.map((account) => account.currency))].map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </Field>
      </div>
      <details className="advanced">
        <summary>More filters and sorting</summary>
        <div className="filters">
          <Field label="Merchant">
            <select
              value={filters.merchant}
              onChange={(event) => change('merchant', event.target.value)}
            >
              <option value="">All merchants</option>
              {snapshot.merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select value={filters.type} onChange={(event) => change('type', event.target.value)}>
              <option value="">All types</option>
              {transactionTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Direction">
            <select
              value={filters.direction}
              onChange={(event) => change('direction', event.target.value)}
            >
              <option value="">All directions</option>
              <option value="income">Incoming</option>
              <option value="expense">Outgoing</option>
            </select>
          </Field>
          <Field label="Minimum signed amount">
            <input
              disabled={!filters.currency}
              inputMode="decimal"
              value={filters.minimum}
              onChange={(event) => change('minimum', event.target.value)}
            />
          </Field>
          <Field label="Maximum signed amount">
            <input
              disabled={!filters.currency}
              inputMode="decimal"
              value={filters.maximum}
              onChange={(event) => change('maximum', event.target.value)}
            />
          </Field>
          <Field label="Recurring">
            <select
              value={filters.recurring}
              onChange={(event) => change('recurring', event.target.value)}
            >
              <option value="">All payments</option>
              <option value="yes">Recurring</option>
              <option value="no">Non-recurring</option>
            </select>
          </Field>
          <Field label="Sort">
            <select
              value={filters.sort}
              onChange={(event) => change('sort', event.target.value as TransactionFilters['sort'])}
            >
              <option value="DATE_DESC">Newest first</option>
              <option value="DATE_ASC">Oldest first</option>
              <option value="AMOUNT_ASC">Amount ascending (by currency)</option>
              <option value="AMOUNT_DESC">Amount descending (by currency)</option>
            </select>
          </Field>
        </div>
        <p className="muted">
          Amount filters use signed values. Select a currency before entering limits.
        </p>
      </details>
      {filtered.error && <p role="alert">{filtered.error}</p>}
      {!snapshot.transactions.length ? (
        <EmptyState />
      ) : (
        <>
          <p className="muted">{filtered.transactions.length} matching transactions</p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th className="numeric">Amount</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.transactions
                  .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
                  .map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatDate(transaction.transactionDate)}</td>
                      <td>
                        <strong>{transaction.counterparty || transaction.rawDescription}</strong>
                        <small>
                          {transaction.counterparty ? transaction.rawDescription : transaction.note}
                        </small>
                      </td>
                      <td>
                        {snapshot.categories.find(
                          (category) => category.id === transaction.categoryId,
                        )?.name ?? 'Uncategorized'}
                      </td>
                      <td>
                        <span className="status">
                          {transaction.type === 'TRANSFER' ? 'Internal Transfer' : transaction.type}
                        </span>
                        {transaction.recurringStatus !== 'NONE' && (
                          <small>{transaction.recurringStatus}</small>
                        )}
                      </td>
                      <td className={`numeric ${transaction.amount > 0 ? 'positive' : ''}`}>
                        {formatMoney(transaction.amount, transaction.currency)}
                      </td>
                      <td>
                        <button
                          className="secondary compact"
                          onClick={() => setEditing(transaction)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableWrap>
          {!filtered.transactions.length && <p>No transactions match these filters.</p>}
          <div className="pagination">
            <button
              className="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              className="secondary"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </>
  );
}
