import { useState } from 'react';
import { ruleOperators, type CategorizationRule } from '../domain/models';
import { moneyInput, parseMoney } from '../domain/values';
import { repository } from '../infrastructure/repository';
import { useAction, useSnapshot } from '../shared/hooks';
import { Feedback, Field, Loading, PageHeader, Panel, TableWrap } from '../shared/components';
const newRule = (): CategorizationRule => ({
  id: crypto.randomUUID(),
  operator: 'MERCHANT_CONTAINS',
  value: '',
  categoryId: 'groceries',
  priority: 10,
  enabled: true,
  currency: 'PLN',
});
export default function Categories() {
  const snapshot = useSnapshot();
  const action = useAction();
  const [categoryName, setCategoryName] = useState('');
  const [rule, setRule] = useState(newRule);
  const [ruleValue, setRuleValue] = useState('');
  const [applyExisting, setApplyExisting] = useState(false);
  const [merchantName, setMerchantName] = useState('');
  const [alias, setAlias] = useState('');
  const [merchantCategory, setMerchantCategory] = useState('');
  if (!snapshot) return <Loading />;
  return (
    <>
      <PageHeader
        title="Categories & rules"
        description="Make classification consistent with rules you can inspect and change."
      />
      <Feedback {...action} />
      <Panel title="Your categories">
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              if (
                snapshot.categories.some(
                  (category) => category.name.toLowerCase() === categoryName.trim().toLowerCase(),
                )
              )
                throw new Error('This category already exists');
              await repository.saveCategory({
                id: crypto.randomUUID(),
                name: categoryName,
                color: '#276f65',
              });
              setCategoryName('');
            });
          }}
        >
          <Field label="New category name">
            <input
              required
              maxLength={80}
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            />
          </Field>
          <button disabled={action.busy}>Create category</button>
        </form>
        <div className="chips">
          {snapshot.categories.map((category) => (
            <span className="chip" key={category.id}>
              {category.name}
            </span>
          ))}
        </div>
      </Panel>
      <Panel title="Categorization rule">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              await repository.saveRule(
                {
                  ...rule,
                  value: rule.operator.startsWith('AMOUNT_')
                    ? String(parseMoney(ruleValue, rule.currency))
                    : ruleValue,
                },
                applyExisting,
              );
              setRule(newRule());
              setRuleValue('');
            }, 'Rule saved');
          }}
        >
          <Field label="Condition">
            <select
              value={rule.operator}
              onChange={(event) =>
                setRule({ ...rule, operator: event.target.value as CategorizationRule['operator'] })
              }
            >
              {ruleOperators.map((operator) => (
                <option key={operator}>{operator}</option>
              ))}
            </select>
          </Field>
          <Field
            label={
              rule.operator.startsWith('AMOUNT_') ? 'Signed amount threshold' : 'Matching text'
            }
          >
            <input
              required
              value={ruleValue}
              onChange={(event) => setRuleValue(event.target.value)}
            />
          </Field>
          {rule.operator.startsWith('AMOUNT_') && (
            <Field label="Rule currency">
              <input
                required
                maxLength={3}
                pattern="[A-Z]{3}"
                value={rule.currency ?? 'PLN'}
                onChange={(event) =>
                  setRule({ ...rule, currency: event.target.value.toUpperCase() })
                }
              />
            </Field>
          )}
          <Field label="Assign category">
            <select
              value={rule.categoryId}
              onChange={(event) => setRule({ ...rule, categoryId: event.target.value })}
            >
              {snapshot.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority (lower runs first)">
            <input
              type="number"
              min={0}
              max={9999}
              required
              value={rule.priority}
              onChange={(event) => setRule({ ...rule, priority: Number(event.target.value) })}
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={applyExisting}
              onChange={(event) => setApplyExisting(event.target.checked)}
            />
            Apply to existing matching transactions
          </label>
          <div className="actions">
            <button disabled={action.busy}>Save rule</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setRule(newRule());
                setRuleValue('');
              }}
            >
              New rule
            </button>
          </div>
        </form>
        <p className="muted">
          Priority: user rules → merchant mapping → manual history → keywords → uncategorized.
          Applying a rule to existing transactions explicitly replaces matching manual categories.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Condition</th>
                <th>Value</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...snapshot.rules]
                .sort((first, second) => first.priority - second.priority)
                .map((existing) => (
                  <tr key={existing.id}>
                    <td>{existing.priority}</td>
                    <td>{existing.operator}</td>
                    <td>
                      {existing.operator.startsWith('AMOUNT_')
                        ? `${moneyInput(Number(existing.value), existing.currency ?? 'PLN')} ${existing.currency}`
                        : existing.value}
                    </td>
                    <td>
                      {
                        snapshot.categories.find((category) => category.id === existing.categoryId)
                          ?.name
                      }
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="secondary compact"
                          onClick={() => {
                            setRule(existing);
                            setRuleValue(
                              existing.operator.startsWith('AMOUNT_')
                                ? moneyInput(Number(existing.value), existing.currency ?? 'PLN')
                                : existing.value,
                            );
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="secondary compact"
                          onClick={() =>
                            action.run(() =>
                              repository.saveRule(
                                { ...existing, enabled: !existing.enabled },
                                false,
                              ),
                            )
                          }
                        >
                          {existing.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="secondary compact"
                          onClick={() => action.run(() => repository.deleteRule(existing.id))}
                        >
                          Delete rule
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TableWrap>
        {!snapshot.rules.length && (
          <p className="muted">
            No user rules yet. Add a condition above or create one from a transaction correction.
          </p>
        )}
      </Panel>
      <Panel title="Merchant aliases">
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              const existing = snapshot.merchants.find(
                (merchant) => merchant.name.toUpperCase() === merchantName.trim().toUpperCase(),
              );
              const merchant = {
                id: existing?.id ?? crypto.randomUUID(),
                name: merchantName.trim(),
                categoryId: merchantCategory || undefined,
              };
              await repository.saveMerchant(merchant, {
                id: crypto.randomUUID(),
                merchantId: merchant.id,
                pattern: alias.trim(),
              });
              setMerchantName('');
              setAlias('');
            }, 'Merchant mapping saved for future imports');
          }}
        >
          <Field label="Merchant name">
            <input
              required
              maxLength={200}
              value={merchantName}
              onChange={(event) => setMerchantName(event.target.value)}
            />
          </Field>
          <Field label="Description contains alias">
            <input
              required
              maxLength={200}
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
            />
          </Field>
          <Field label="Merchant category">
            <select
              value={merchantCategory}
              onChange={(event) => setMerchantCategory(event.target.value)}
            >
              <option value="">No default category</option>
              {snapshot.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <button disabled={action.busy}>Save merchant alias</button>
        </form>
        {snapshot.merchantAliases.map((alias) => (
          <p key={alias.id}>
            {alias.pattern} →{' '}
            {snapshot.merchants.find((merchant) => merchant.id === alias.merchantId)?.name}
          </p>
        ))}
      </Panel>
    </>
  );
}
