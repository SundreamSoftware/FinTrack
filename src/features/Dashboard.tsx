import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowUpRight } from 'lucide-react';
import {
  activeBudgets,
  budgetUsage,
  cashFlow,
  categoryTotals,
  financialInsights,
  forecastSavings,
  monthlySeries,
  monthlySubscriptionCost,
} from '../domain/analytics';
import { formatMoney, monthOffset, percentage, sumMoney, today } from '../domain/values';
import { useSnapshot } from '../shared/hooks';
import { EmptyState, Field, Loading, PageHeader, Panel, Stat } from '../shared/components';
const Chart = lazy(() =>
  import('../shared/Charts').then((module) => ({ default: module.CashFlowChart })),
);
export default function Dashboard() {
  const snapshot = useSnapshot();
  const [currency, setCurrency] = useState('PLN');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [range, setRange] = useState(6);
  const analytics = useMemo(() => {
    if (!snapshot) return null;
    const current = cashFlow(snapshot.transactions, currency, month);
    const previous = cashFlow(snapshot.transactions, currency, monthOffset(month, -1));
    const categories = categoryTotals(snapshot.transactions, currency, month);
    const previousCategories = categoryTotals(
      snapshot.transactions,
      currency,
      monthOffset(month, -1),
    );
    const budgets = activeBudgets(snapshot.budgets, month, currency).map((budget) => ({
      ...budget,
      ...budgetUsage(budget, categories.get(budget.categoryId) ?? 0),
    }));
    const recurring = sumMoney(
      snapshot.subscriptions
        .filter(
          (subscription) =>
            subscription.currency === currency &&
            (subscription.status === 'CONFIRMED' || subscription.status === 'DETECTED'),
        )
        .map(monthlySubscriptionCost),
    );
    return {
      current,
      previous,
      categories,
      previousCategories,
      budgets,
      recurring,
      flows: monthlySeries(snapshot.transactions, currency, range, month),
      forecast: forecastSavings(snapshot.transactions, snapshot.subscriptions, currency, 3),
      insights: financialInsights(snapshot.transactions, snapshot.budgets, currency, month),
      largest: snapshot.transactions
        .filter(
          (transaction) =>
            transaction.currency === currency &&
            transaction.transactionDate.startsWith(month) &&
            transaction.amount < 0 &&
            transaction.type !== 'TRANSFER',
        )
        .sort((first, second) => first.amount - second.amount)
        .slice(0, 5),
    };
  }, [snapshot, currency, month, range]);
  if (!snapshot || !analytics) return <Loading />;
  const currencyOptions = [
    ...new Set(['PLN', ...snapshot.accounts.map((account) => account.currency)]),
  ];
  return (
    <>
      <PageHeader
        title="Financial overview"
        description="A clear picture of what comes in, goes out, and stays yours."
      >
        <Link className="button" to="/import">
          <Plus size={18} />
          Import transactions
        </Link>
      </PageHeader>
      <div className="toolbar">
        <Field label="Month">
          <input
            type="month"
            value={month}
            onChange={(event) => event.target.value && setMonth(event.target.value)}
          />
        </Field>
        <Field label="Currency">
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencyOptions.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </Field>
        <span className="muted">
          Compared with {monthOffset(month, -1)} · currencies are never combined
        </span>
      </div>
      {!snapshot.transactions.length ? (
        <EmptyState />
      ) : (
        <>
          <div className="stats">
            <Stat
              label="Income"
              value={formatMoney(analytics.current.income, currency)}
              detail={`${formatMoney(analytics.current.income - analytics.previous.income, currency)} vs last month`}
            />
            <Stat
              label="Expenses"
              value={formatMoney(analytics.current.expenses, currency)}
              detail={`${formatMoney(analytics.current.expenses - analytics.previous.expenses, currency)} vs last month`}
            />
            <Stat
              label="Net cash flow"
              value={formatMoney(analytics.current.net, currency)}
              detail="Income less expenses"
            />
            <Stat
              label="Savings rate"
              value={percentage(analytics.current.savingsRate)}
              detail={
                analytics.current.savingsRate === null
                  ? 'No income this month'
                  : 'Share of income retained'
              }
            />
          </div>
          <div className="dashboard-grid">
            <Panel
              title="Cash flow"
              action={
                <Field label="Chart range">
                  <select value={range} onChange={(event) => setRange(Number(event.target.value))}>
                    {[1, 3, 6, 12].map((count) => (
                      <option key={count} value={count}>
                        {count}M
                      </option>
                    ))}
                  </select>
                </Field>
              }
            >
              <Suspense fallback={<Loading />}>
                <Chart flows={analytics.flows} currency={currency} />
              </Suspense>
              <Link className="text-link" to="/reports">
                View detailed report <ArrowUpRight size={16} />
              </Link>
            </Panel>
            <Panel title="Top categories" action={<span className="muted">This month</span>}>
              {[...analytics.categories]
                .filter(([, amount]) => amount > 0)
                .sort((first, second) => second[1] - first[1])
                .slice(0, 5)
                .map(([id, amount]) => {
                  const category = snapshot.categories.find((category) => category.id === id);
                  const previous = analytics.previousCategories.get(id) ?? 0;
                  const share =
                    analytics.current.expenses > 0
                      ? (amount / analytics.current.expenses) * 100
                      : 0;
                  return (
                    <Link
                      key={id}
                      className="category-row"
                      to={`/transactions?category=${encodeURIComponent(id)}&month=${month}&currency=${currency}`}
                    >
                      <div>
                        <strong>{category?.name ?? 'Uncategorized'}</strong>
                        <span>{formatMoney(amount, currency)}</span>
                      </div>
                      <progress
                        aria-label={`${category?.name ?? id} share`}
                        value={Math.min(100, share)}
                        max={100}
                      />
                      <small>
                        {percentage(share)} of expenses · {formatMoney(amount - previous, currency)}{' '}
                        vs previous
                      </small>
                    </Link>
                  );
                })}
              {!analytics.current.expenses && <p className="muted">No expenses in this period.</p>}
            </Panel>
            <Panel
              title="Monthly budgets"
              action={
                <Link to="/budgets" className="text-link">
                  Manage
                </Link>
              }
            >
              {analytics.budgets.length ? (
                analytics.budgets.slice(0, 4).map((budget) => (
                  <div key={budget.id} className="budget-row">
                    <div>
                      <strong>
                        {
                          snapshot.categories.find((category) => category.id === budget.categoryId)
                            ?.name
                        }
                      </strong>
                      <span className={`status ${budget.status.toLowerCase()}`}>
                        {budget.status}
                      </span>
                    </div>
                    <progress
                      value={Math.min(100, budget.usage)}
                      max={100}
                      aria-label="Budget usage"
                    />
                    <small>
                      {formatMoney(budget.spent, currency)} of{' '}
                      {formatMoney(budget.amount, currency)} · {percentage(budget.usage)}
                    </small>
                  </div>
                ))
              ) : (
                <p className="muted">Create a category budget to track your spending limits.</p>
              )}
            </Panel>
            <Panel title="Looking ahead">
              <div className="forecast-callout">
                <p>Expected savings · next 3 months</p>
                <strong>
                  {formatMoney(analytics.forecast.points.at(-1)?.expected ?? 0, currency)}
                </strong>
                <p>{analytics.forecast.historyMonths} complete months of history</p>
                <Link to="/forecast" className="text-link">
                  Explore your forecast <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="recurring-summary">
                <span>Estimated recurring / month</span>
                <strong>{formatMoney(analytics.recurring, currency)}</strong>
              </div>
              <Link to="/subscriptions" className="text-link">
                Review recurring payments
              </Link>
            </Panel>
            <Panel title="Largest expenses">
              {analytics.largest.map((transaction) => (
                <div className="list-row" key={transaction.id}>
                  <div>
                    <strong>{transaction.counterparty || transaction.rawDescription}</strong>
                    <small>{transaction.transactionDate}</small>
                  </div>
                  <strong>{formatMoney(transaction.amount, currency)}</strong>
                </div>
              ))}
              {!analytics.largest.length && <p className="muted">No expenses in this period.</p>}
            </Panel>
            <Panel title="Financial insights">
              {analytics.insights.length ? (
                analytics.insights.map((insight) => (
                  <p className="insight" key={insight.id}>
                    {insight.text}
                  </p>
                ))
              ) : (
                <p className="muted">
                  Insights appear when there is enough history or a budget approaches its limit.
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
