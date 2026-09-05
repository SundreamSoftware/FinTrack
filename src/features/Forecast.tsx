import { useMemo, useState } from 'react';
import { forecastSavings } from '../domain/analytics';
import { formatMoney } from '../domain/values';
import { useSnapshot } from '../shared/hooks';
import {
  EmptyState,
  Field,
  Loading,
  PageHeader,
  Panel,
  Stat,
  TableWrap,
} from '../shared/components';
import { ForecastChart } from '../shared/Charts';
export default function ForecastPage() {
  const snapshot = useSnapshot();
  const [currency, setCurrency] = useState('PLN');
  const [horizon, setHorizon] = useState(6);
  const forecast = useMemo(
    () =>
      forecastSavings(
        snapshot?.transactions ?? [],
        snapshot?.subscriptions ?? [],
        currency,
        horizon,
      ),
    [snapshot, currency, horizon],
  );
  if (!snapshot) return <Loading />;
  const last = forecast.points.at(-1);
  return (
    <>
      <PageHeader
        title="Savings forecast"
        description="A transparent estimate based on your recent financial history."
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
        <Field label="Forecast horizon">
          <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
            {[1, 3, 6, 12].map((months) => (
              <option key={months} value={months}>
                {months} months
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!forecast.historyMonths ? (
        <EmptyState
          title="A complete month of history is needed."
          description="Import historical transactions to estimate future savings. The current, incomplete month is excluded."
        />
      ) : (
        <>
          <div className="stats">
            <Stat label="Expected savings" value={formatMoney(last?.expected ?? 0, currency)} />
            <Stat label="Lower estimate" value={formatMoney(last?.lower ?? 0, currency)} />
            <Stat label="Upper estimate" value={formatMoney(last?.upper ?? 0, currency)} />
          </div>
          <Panel title={`Estimated accumulation · ${horizon} months`}>
            <ForecastChart points={forecast.points} currency={currency} />
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Expected savings</th>
                    <th>Lower estimate</th>
                    <th>Upper estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.points.map((point) => (
                    <tr key={point.month}>
                      <td>{point.month}</td>
                      <td>{formatMoney(point.expected, currency)}</td>
                      <td>{formatMoney(point.lower, currency)}</td>
                      <td>{formatMoney(point.upper, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
          <Panel title="What the estimate uses">
            <dl className="definition-grid">
              <dt>Complete history</dt>
              <dd>{forecast.historyMonths} months (up to six)</dd>
              <dt>Average monthly income</dt>
              <dd>{formatMoney(forecast.averageIncome, currency)}</dd>
              <dt>Historical fixed expenses</dt>
              <dd>{formatMoney(forecast.averageFixedExpenses, currency)}</dd>
              <dt>Average variable expenses</dt>
              <dd>{formatMoney(forecast.averageVariableExpenses, currency)}</dd>
              <dt>Known recurring expenses / month</dt>
              <dd>{formatMoney(forecast.knownRecurringExpenses, currency)}</dd>
              <dt>Recent spending trend adjustment</dt>
              <dd>{formatMoney(forecast.monthlyTrend, currency)}</dd>
            </dl>
            <p>
              Monthly savings = average income − variable expenses − known recurring payments −
              trend adjustment. Historical recurring payments are removed from variable spending to
              prevent double counting. Run subscription detection after importing.
            </p>
            <p className="muted">
              The range uses historical cash-flow variability plus a 10% model allowance, scaled by
              the square root of the horizon. It is a scenario range, not a statistical confidence
              interval or guarantee. Initial account balances are excluded. Future income changes
              and investment returns are not predicted.
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
