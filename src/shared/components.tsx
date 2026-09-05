import { type ReactNode, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">YOUR FINANCES, IN FOCUS</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}
export function EmptyState({
  title = 'No transactions yet.',
  description = 'Import a CSV file or load demo data to start analyzing your finances.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button" to="/import">
        Import transactions
      </Link>
      <Link className="button secondary" to="/settings">
        Manage local data
      </Link>
    </div>
  );
}
export function Feedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="feedback error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="feedback success">
          {notice}
        </p>
      )}
    </>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="stat">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  );
}
export function Loading() {
  return (
    <p role="status" className="loading">
      Loading local data…
    </p>
  );
}
export function ConfirmDialog({
  title,
  children,
  onCancel,
  onConfirm,
  busy = false,
  confirmDisabled = false,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="confirm-title" onCancel={onCancel}>
      <h2 id="confirm-title">{title}</h2>
      {children}
      <div className="actions">
        <button className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="danger" onClick={onConfirm} disabled={busy || confirmDisabled}>
          {busy ? 'Working…' : 'Confirm'}
        </button>
      </div>
    </dialog>
  );
}
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
      {children}
    </div>
  );
}
