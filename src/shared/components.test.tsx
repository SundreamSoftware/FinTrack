import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { EmptyState, Feedback, Field } from './components';
describe('accessible feedback', () => {
  it('provides an actionable empty state', () => {
    render(
      <MemoryRouter>
        <EmptyState />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Import transactions' })).toHaveAttribute(
      'href',
      '/import',
    );
  });
  it('announces validation failures without technical stack traces', () => {
    render(<Feedback error="Choose a valid account" notice="" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid account');
  });
});

it('keeps select labels independent of option text', () => {
  render(
    <Field label="Import account">
      <select>
        <option>Choose an account</option>
        <option>Personal · PLN</option>
      </select>
    </Field>,
  );
  expect(screen.getByLabelText('Import account', { exact: true })).toHaveRole('combobox');
});
