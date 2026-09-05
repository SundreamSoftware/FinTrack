import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryTotals, monthlySeries } from '../domain/analytics';
import { formatMoney, monthOffset, percentage, today } from '../domain/values';
import { useSnapshot } from '../shared/hooks';
import { EmptyState, Field, Loading, PageHeader, Panel, TableWrap } from '../shared/components';
import { CashFlowChart } from '../shared/Charts';
export default function Reports() {
  const snapshot = useSnapshot();
  const [currency, setCurrency] = useState('PLN');
  const [range, setRange] = useState<number | 'ALL'>(12);
  const [month, setMonth] = useState(today().slice(0, 7));
  const series = useMemo(
    () => monthlySeries(snapshot?.transactions ?? [], currency, range, month),
    [snapshot, currency, range, month],
  );
  const categories = useMemo(
    () => categoryTotals(snapshot?.transactions ?? [], currency, month),
    [snapshot, currency, month],
  );
  const previousCategories = useMemo(
    () => categoryTotals(snapshot?.transactions ?? [], currency, monthOffset(month, -1)),
    [snapshot, currency, month],
  );
  if (!snapshot) return <Loading />;
  return (
    <>
      <PageHeader
        title="Reports"
        description="Compare monthly cash flow and follow category-level changes."
      />
      <div className="toolbar">
        <Field label="Currency">
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {[...new Set(['PLN', ...snapshot.accounts.map((account) => account.currency)])].map(
              (currency) => (
                <option key={currency}>{currency}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="End month">
          <input
            type="month"
            value={month}
            onChange={(event) => event.target.value && setMonth(event.target.value)}
          />
        </Field>
        <Field label="Range">
          <select
            value={range}
            onChange={(event) =>
              setRange(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))
            }
          >
            {[1, 3, 6, 12].map((months) => (
              <option key={months} value={months}>
                {months}M
              </option>
            ))}
            <option value="ALL">All</option>
          </select>
        </Field>
      </div>
      {!snapshot.transactions.length ? (
        <EmptyState />
      ) : (
        <>
          <Panel title="Monthly cash flow">
            <CashFlowChart flows={series} currency={currency} />
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Net cash flow</th>
                    <th>Savings rate</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((flow) => (
                    <tr key={flow.month}>
                      <td>{flow.month}</td>
                      <td>{formatMoney(flow.income, currency)}</td>
                      <td>{formatMoney(flow.expenses, currency)}</td>
                      <td>{formatMoney(flow.net, currency)}</td>
                      <td>{percentage(flow.savingsRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
          <Panel title={`Category comparison · ${month}`}>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Current month</th>
                    <th>Previous month</th>
                    <th>Change</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {[...new Set([...categories.keys(), ...previousCategories.keys()])].map((id) => (
                    <tr key={id}>
                      <td>
                        {snapshot.categories.find((category) => category.id === id)?.name ??
                          'Uncategorized'}
                      </td>
                      <td>{formatMoney(categories.get(id) ?? 0, currency)}</td>
                      <td>{formatMoney(previousCategories.get(id) ?? 0, currency)}</td>
                      <td>
                        {formatMoney(
                          (categories.get(id) ?? 0) - (previousCategories.get(id) ?? 0),
                          currency,
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/transactions?category=${id}&month=${month}&currency=${currency}`}
                        >
                          View transactions
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </>
      )}
    </>
  );
}
