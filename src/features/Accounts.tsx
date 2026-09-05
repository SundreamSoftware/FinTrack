import { useState } from 'react';
import { accountTypes, type Account } from '../domain/models';
import { formatMoney, metadata, moneyInput, parseMoney, sumMoney } from '../domain/values';
import { repository } from '../infrastructure/repository';
import { useAction, useSnapshot } from '../shared/hooks';
import { ConfirmDialog, Feedback, Field, Loading, PageHeader, Panel } from '../shared/components';
const newAccount = (): Account => ({
  ...metadata(),
  name: '',
  type: 'CHECKING',
  institutionName: '',
  currency: 'PLN',
  initialBalance: 0,
  archived: false,
  demo: false,
});
export default function Accounts() {
  const snapshot = useSnapshot();
  const action = useAction();
  const [account, setAccount] = useState<Account>(newAccount);
  const [balance, setBalance] = useState('0');
  const [deleting, setDeleting] = useState<Account>();
  if (!snapshot) return <Loading />;
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Keep your everyday, savings and cash accounts organized."
      />
      <Feedback {...action} />
      <Panel
        title={
          snapshot.accounts.some((existing) => existing.id === account.id)
            ? 'Edit account'
            : 'Create account'
        }
      >
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              await repository.saveAccount({
                ...account,
                initialBalance: parseMoney(balance, account.currency),
                updatedAt: new Date().toISOString(),
              });
              setAccount(newAccount());
              setBalance('0');
            }, 'Account saved');
          }}
        >
          <Field label="Account name">
            <input
              required
              maxLength={100}
              value={account.name}
              onChange={(event) => setAccount({ ...account, name: event.target.value })}
            />
          </Field>
          <Field label="Institution">
            <input
              maxLength={100}
              value={account.institutionName}
              onChange={(event) => setAccount({ ...account, institutionName: event.target.value })}
            />
          </Field>
          <Field label="Account type">
            <select
              value={account.type}
              onChange={(event) =>
                setAccount({ ...account, type: event.target.value as Account['type'] })
              }
            >
              {accountTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Account currency">
            <input
              required
              pattern="[A-Z]{3}"
              maxLength={3}
              value={account.currency}
              onChange={(event) =>
                setAccount({ ...account, currency: event.target.value.toUpperCase() })
              }
            />
          </Field>
          <Field label="Initial balance">
            <input
              required
              inputMode="decimal"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
            />
          </Field>
          <div className="form-buttons">
            <button disabled={action.busy}>Save account</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setAccount(newAccount());
                setBalance('0');
              }}
            >
              New account
            </button>
          </div>
        </form>
      </Panel>
      <div className="account-grid">
        {snapshot.accounts.map((existing) => {
          const transactions = snapshot.transactions.filter(
            (transaction) => transaction.accountId === existing.id,
          );
          const currentBalance = sumMoney([
            existing.initialBalance,
            ...transactions.map((transaction) => transaction.amount),
          ]);
          return (
            <Panel key={existing.id} title={existing.name}>
              <p className="muted">
                {existing.institutionName || 'Personal account'} · {existing.type}
              </p>
              <p className="account-balance">{formatMoney(currentBalance, existing.currency)}</p>
              <p>
                {transactions.length} transactions · {existing.archived ? 'Archived' : 'Active'}
              </p>
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() => {
                    setAccount(existing);
                    setBalance(moneyInput(existing.initialBalance, existing.currency));
                  }}
                >
                  Edit
                </button>
                <button
                  className="secondary"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(() =>
                      repository.saveAccount({
                        ...existing,
                        archived: !existing.archived,
                        updatedAt: new Date().toISOString(),
                      }),
                    )
                  }
                >
                  {existing.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button className="danger secondary" onClick={() => setDeleting(existing)}>
                  Delete
                </button>
              </div>
            </Panel>
          );
        })}
      </div>
      {!snapshot.accounts.length && (
        <p className="muted">Create your first account before importing transactions.</p>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          onCancel={() => setDeleting(undefined)}
          busy={action.busy}
          onConfirm={() =>
            void action.run(async () => {
              await repository.deleteAccount(deleting.id);
              setDeleting(undefined);
            }, 'Account and its transactions deleted')
          }
        >
          <p>
            This permanently deletes the account, its{' '}
            {
              snapshot.transactions.filter((transaction) => transaction.accountId === deleting.id)
                .length
            }{' '}
            transactions, import history and subscriptions. Export a backup first if needed.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
