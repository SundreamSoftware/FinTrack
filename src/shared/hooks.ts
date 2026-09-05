import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import { repository } from '../infrastructure/repository';
export function useSnapshot() {
  return useLiveQuery(() => repository.read(), []);
}
export function readableError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError')
      return 'Browser storage is full. Export a backup and free space before retrying.';
    if (error.name === 'ZodError')
      return 'Validation failed. Check amounts, dates, currencies and referenced records.';
    if (error.name === 'DatabaseClosedError' || error.name === 'InvalidStateError')
      return 'Local storage is unavailable. Enable browser storage and reopen FinTrack.';
    return error.message;
  }
  return 'The operation failed. Your existing data has been kept.';
}
export function useAction() {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (operation: () => Promise<void>, success = 'Saved') => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await operation();
      setNotice(success);
    } catch (error) {
      setError(readableError(error));
    } finally {
      setBusy(false);
    }
  }, []);
  return { error, notice, busy, run };
}
