import { useState } from 'react';
import type { Snapshot } from '../domain/models';
import { repository } from '../infrastructure/repository';
import { downloadBackup, MAX_BACKUP_BYTES, parseBackup } from '../infrastructure/backup';
import { createDemo } from '../infrastructure/demo';
import { useAction, useSnapshot } from '../shared/hooks';
import { ConfirmDialog, Feedback, Field, Loading, PageHeader, Panel } from '../shared/components';
export default function Settings() {
  const snapshot = useSnapshot();
  const action = useAction();
  const [restore, setRestore] = useState<Snapshot>();
  const [reset, setReset] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [clearDemo, setClearDemo] = useState(false);
  if (!snapshot) return <Loading />;
  return (
    <>
      <PageHeader
        title="Settings"
        description="Your data, your device. Keep a backup you control."
      />
      <Feedback {...action} />
      <Panel title="Backup & restore">
        <p>
          Browser data can be lost when site storage is cleared or your browser profile is removed.
          Export backups regularly. JSON backups contain readable financial data; store them
          privately.
        </p>
        <div className="actions">
          <button
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                downloadBackup(await repository.read());
                await repository.setSetting('lastBackup', new Date().toISOString());
              }, 'Backup exported')
            }
          >
            Export backup
          </button>
          <Field label="Import backup">
            <input
              type="file"
              accept=".json,application/json"
              disabled={action.busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file)
                  void action.run(async () => {
                    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 40 MB');
                    setRestore(parseBackup(await file.text()));
                  }, 'Backup validated. Review before restoring.');
              }}
            />
          </Field>
        </div>
        <p className="muted">
          Last export:{' '}
          {snapshot.settings.find((setting) => setting.id === 'lastBackup')?.value ??
            'No backup exported yet'}
        </p>
      </Panel>
      <Panel title="Portfolio demo">
        <p>
          Load fictional accounts and six months of transactions to explore the dashboard, budgets
          and forecasts. Demo loading is available only in an empty workspace.
        </p>
        <div className="actions">
          <button
            disabled={
              snapshot.accounts.length > 0 || snapshot.transactions.length > 0 || action.busy
            }
            onClick={() =>
              action.run(() => repository.replace(createDemo()), 'Fictional demo loaded')
            }
          >
            Load demo data
          </button>
          <button
            className="secondary"
            disabled={!snapshot.accounts.some((account) => account.demo) || action.busy}
            onClick={() => setClearDemo(true)}
          >
            Clear demo data
          </button>
        </div>
      </Panel>
      <Panel title="Privacy & local storage">
        <p>
          Your financial data stays in your browser. FinTrack does not upload transaction history to
          a server.
        </p>
        <p>
          Each browser profile and device has separate storage. IndexedDB is not encrypted by
          FinTrack. Use a trusted device and secure your browser profile.
        </p>
        <button
          className="secondary"
          disabled={action.busy}
          onClick={() =>
            action.run(async () => {
              if (!navigator.storage?.persist)
                throw new Error('Persistent storage requests are not supported in this browser');
              const granted = await navigator.storage.persist();
              if (!granted)
                throw new Error(
                  'The browser did not grant persistent storage. Continue keeping backups.',
                );
            }, 'Persistent storage enabled')
          }
        >
          Request persistent storage
        </button>
      </Panel>
      <Panel title="Delete all local data">
        <p>
          This removes all accounts, transactions, rules, budgets and local settings from this
          browser.
        </p>
        <button
          className="danger"
          onClick={() => {
            setReset(true);
            setConfirmation('');
          }}
        >
          Delete all local data
        </button>
      </Panel>
      {restore && (
        <ConfirmDialog
          title="Replace local data with this backup?"
          busy={action.busy}
          onCancel={() => setRestore(undefined)}
          onConfirm={() =>
            void action.run(async () => {
              await repository.replace(restore);
              setRestore(undefined);
            }, 'Backup restored')
          }
        >
          <p>
            The validated backup contains {restore.accounts.length} accounts and{' '}
            {restore.transactions.length} transactions. All current local data will be replaced
            atomically.
          </p>
        </ConfirmDialog>
      )}
      {clearDemo && (
        <ConfirmDialog
          title="Clear demo data?"
          busy={action.busy}
          onCancel={() => setClearDemo(false)}
          onConfirm={() =>
            void action.run(async () => {
              await repository.clearDemo();
              setClearDemo(false);
            }, 'Demo accounts and transactions cleared')
          }
        >
          <p>
            Demo accounts and their transaction history will be deleted. Categories, rules and
            budgets are kept so customizations are preserved.
          </p>
        </ConfirmDialog>
      )}
      {reset && (
        <ConfirmDialog
          title="Permanently delete local data?"
          busy={action.busy}
          confirmDisabled={confirmation !== 'DELETE'}
          onCancel={() => setReset(false)}
          onConfirm={() =>
            void action.run(async () => {
              if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm');
              await repository.clear();
              setReset(false);
            }, 'All local data deleted')
          }
        >
          <Field label="Type DELETE to confirm">
            <input
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}
