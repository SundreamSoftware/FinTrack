import { useMemo, useState } from 'react';
import { activeBudgets, budgetUsage, categoryTotals } from '../domain/analytics';
import { formatMoney, metadata, moneyInput, parseMoney, percentage, today } from '../domain/values';
import type { Budget } from '../domain/models';
import { repository } from '../infrastructure/repository';
import { useAction, useSnapshot } from '../shared/hooks';
import { Feedback, Field, Loading, PageHeader, Panel, Stat } from '../shared/components';
export default function Budgets() {
  const snapshot = useSnapshot();
  const action = useAction();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [currency, setCurrency] = useState('PLN');
  const [categoryId, setCategoryId] = useState('groceries');
  const [amount, setAmount] = useState('');
  const [recurrence, setRecurrence] = useState<Budget['recurrence']>('MONTHLY');
  const [editing, setEditing] = useState<Budget>();
  const totals = useMemo(
    () => categoryTotals(snapshot?.transactions ?? [], currency, month),
    [snapshot, currency, month],
  );
  if (!snapshot) return <Loading />;
  return (
    <>
      <PageHeader
        title="Budgets"
        description="Set a monthly limit and see how much room remains."
      />
      <Feedback {...action} />
      <Panel title={editing ? 'Edit budget' : 'Create category budget'}>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              await repository.saveBudget({
                ...(editing ?? metadata()),
                categoryId,
                amount: parseMoney(amount, currency),
                currency,
                month,
                recurrence,
                updatedAt: new Date().toISOString(),
              });
              setAmount('');
              setEditing(undefined);
            }, 'Budget saved');
          }}
        >
          <Field label="Budget category">
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {snapshot.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Budget amount">
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field label="Budget currency">
            <input
              required
              pattern="[A-Z]{3}"
              maxLength={3}
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Budget month">
            <input
              required
              type="month"
              value={month}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
            />
          </Field>
          <Field label="Recurrence">
            <select
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value as Budget['recurrence'])}
            >
              <option value="MONTHLY">Monthly from selected month</option>
              <option value="ONCE">Selected month only</option>
            </select>
          </Field>
          <div className="actions">
            <button disabled={action.busy}>Save budget</button>
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setEditing(undefined);
                  setAmount('');
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </Panel>
      <p className="muted">
        Showing {month} · {currency}. OK below 80%, WARNING from 80%, EXCEEDED at 100% or above.
      </p>
      <div className="account-grid">
        {activeBudgets(snapshot.budgets, month, currency).map((budget) => {
          const usage = budgetUsage(budget, totals.get(budget.categoryId) ?? 0);
          return (
            <Panel
              key={budget.id}
              title={
                snapshot.categories.find((category) => category.id === budget.categoryId)?.name ??
                'Category'
              }
              action={
                <span className={`status ${usage.status.toLowerCase()}`}>{usage.status}</span>
              }
            >
              <Stat
                label="Spent / budget"
                value={`${formatMoney(usage.spent, currency)} / ${formatMoney(budget.amount, currency)}`}
                detail={`${percentage(usage.usage)} used`}
              />
              <progress
                max={100}
                value={Math.min(100, usage.usage)}
                aria-label="Budget utilization"
              />
              <p>
                Remaining: <strong>{formatMoney(usage.remaining, currency)}</strong>
              </p>
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setEditing(budget);
                    setCategoryId(budget.categoryId);
                    setAmount(moneyInput(budget.amount, budget.currency));
                    setCurrency(budget.currency);
                    setMonth(budget.month);
                    setRecurrence(budget.recurrence);
                  }}
                >
                  Edit budget
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    action.run(() => repository.deleteBudget(budget.id), 'Budget deleted')
                  }
                >
                  Delete budget
                </button>
              </div>
            </Panel>
          );
        })}
      </div>
      {!activeBudgets(snapshot.budgets, month, currency).length && (
        <p className="empty">No budgets for this month and currency. Create one above.</p>
      )}
    </>
  );
}
