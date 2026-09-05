import { useState } from 'react';
import { detectSubscriptions } from '../domain/subscriptions';
import { monthlySubscriptionCost } from '../domain/analytics';
import { formatDate, formatMoney, sumMoney } from '../domain/values';
import type { Subscription } from '../domain/models';
import { repository } from '../infrastructure/repository';
import { useAction, useSnapshot } from '../shared/hooks';
import { Feedback, Field, Loading, PageHeader, Panel, Stat, TableWrap } from '../shared/components';
export default function Subscriptions() {
  const snapshot = useSnapshot();
  const action = useAction();
  const [currency, setCurrency] = useState('PLN');
  if (!snapshot) return <Loading />;
  const subscriptions = snapshot.subscriptions.filter(
    (subscription) => subscription.currency === currency,
  );
  const active = subscriptions.filter(
    (subscription) => subscription.status === 'DETECTED' || subscription.status === 'CONFIRMED',
  );
  const monthly = sumMoney(active.map(monthlySubscriptionCost));
  const changeStatus = (subscription: Subscription, status: Subscription['status']) =>
    action.run(() => repository.saveSubscriptions([{ ...subscription, status }]));
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Find recurring payments and decide which ones belong on your list."
      >
        <button
          disabled={action.busy}
          onClick={() =>
            action.run(async () => {
              const current = await repository.read();
              await repository.saveSubscriptions(
                detectSubscriptions(current.transactions, current.merchants, current.subscriptions),
              );
            }, 'Recurring payments analyzed')
          }
        >
          Detect subscriptions
        </button>
      </PageHeader>
      <Feedback {...action} />
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
      </div>
      <div className="stats">
        <Stat label="Active recurring payments" value={String(active.length)} />
        <Stat label="Estimated monthly cost" value={formatMoney(monthly, currency)} />
        <Stat
          label="Estimated yearly cost"
          value={formatMoney(monthly * 12, currency)}
          detail="Includes detected and confirmed candidates"
        />
      </div>
      <Panel title="Recurring payments">
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Frequency</th>
                <th>Next expected payment</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td>
                    {subscription.merchantName}
                    <small>{subscription.occurrences} occurrences</small>
                  </td>
                  <td>{formatMoney(subscription.amount, currency)}</td>
                  <td>{subscription.frequency}</td>
                  <td>{formatDate(subscription.nextPayment)}</td>
                  <td>{Math.round(subscription.confidence * 100)}%</td>
                  <td>{subscription.status}</td>
                  <td>
                    <div className="actions">
                      {subscription.status !== 'CONFIRMED' && (
                        <button
                          className="secondary compact"
                          onClick={() => changeStatus(subscription, 'CONFIRMED')}
                        >
                          {subscription.status === 'REJECTED' || subscription.status === 'INACTIVE'
                            ? 'Reactivate'
                            : 'Confirm subscription'}
                        </button>
                      )}
                      {subscription.status !== 'REJECTED' && (
                        <button
                          className="secondary compact"
                          onClick={() => changeStatus(subscription, 'REJECTED')}
                        >
                          Reject
                        </button>
                      )}
                      {subscription.status === 'CONFIRMED' && (
                        <button
                          className="secondary compact"
                          onClick={() => changeStatus(subscription, 'INACTIVE')}
                        >
                          Mark inactive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {!subscriptions.length && (
          <p className="empty">
            No recurring payments detected. Import at least three occurrences, then run detection.
          </p>
        )}
      </Panel>
      <details className="advanced">
        <summary>How detection works</summary>
        <p>
          Payments are grouped by account, currency and normalized merchant. At least three
          occurrences must fit weekly (6–8 days), monthly (25–35 days) or yearly (350–380 days)
          intervals. One missed period is allowed. Amounts may vary by 12% around the median.
        </p>
        <p>
          Confidence: merchant identity 25%, amount consistency 30%, interval consistency 30%,
          occurrence count 15%. Candidates need 70% confidence. Rejected and inactive statuses
          persist unless the amount changes materially. Expected dates are estimates, not payment
          instructions.
        </p>
      </details>
    </>
  );
}
