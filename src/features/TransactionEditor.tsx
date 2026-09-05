import { useState } from 'react';
import type { Category, Merchant, Transaction } from '../domain/models';
import { transactionTypes } from '../domain/models';
import { normalizeMerchant } from '../domain/categorization';
import { repository } from '../infrastructure/repository';
import { useAction } from '../shared/hooks';
import { Feedback, Field, Panel } from '../shared/components';
export default function TransactionEditor({
  transaction,
  categories,
  merchants,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  merchants: Merchant[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(transaction);
  const [createRule, setCreateRule] = useState(false);
  const [applyExisting, setApplyExisting] = useState(false);
  const action = useAction();
  const merchantName =
    merchants.find((merchant) => merchant.id === transaction.merchantId)?.name ??
    normalizeMerchant(transaction.counterparty || transaction.rawDescription);
  return (
    <Panel title="Edit transaction">
      <Feedback {...action} />
      <p>{transaction.rawDescription}</p>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void action.run(async () => {
            await repository.correctTransaction(
              { ...draft, manualCategory: true },
              createRule && draft.categoryId
                ? {
                    id: crypto.randomUUID(),
                    operator: 'MERCHANT_EQUALS',
                    value: merchantName,
                    categoryId: draft.categoryId,
                    priority: 0,
                    enabled: true,
                  }
                : undefined,
              applyExisting,
            );
            onClose();
          });
        }}
      >
        <Field label="Transaction category">
          <select
            value={draft.categoryId ?? ''}
            onChange={(event) =>
              setDraft({ ...draft, categoryId: event.target.value || undefined })
            }
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Transaction type">
          <select
            value={draft.type}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as Transaction['type'] })
            }
          >
            {transactionTypes.map((type) => (
              <option key={type} value={type}>
                {type === 'TRANSFER' ? 'Internal Transfer' : type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <input
            value={draft.note ?? ''}
            maxLength={4000}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={createRule}
            onChange={(event) => setCreateRule(event.target.checked)}
            disabled={!draft.categoryId}
          />
          Always categorize {merchantName} this way
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={applyExisting}
            disabled={!createRule}
            onChange={(event) => setApplyExisting(event.target.checked)}
          />
          Apply to existing matching transactions
        </label>
        <div className="actions">
          <button disabled={action.busy}>Save transaction</button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel edit
          </button>
        </div>
      </form>
    </Panel>
  );
}
