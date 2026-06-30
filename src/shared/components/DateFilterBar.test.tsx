import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DateFilterBar, { useDateFilter } from './DateFilterBar';
import { AppTestProviders } from '../../test/appTestProviders';

function Harness() {
  const filter = useDateFilter();
  return <DateFilterBar filter={filter} />;
}

afterEach(() => {
  cleanup();
});

describe('DateFilterBar', () => {
  it('opens the central period picker and supports multi-month mode', () => {
    render(
      <AppTestProviders>
        <Harness />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: /الفترة/i }));
    fireEvent.click(screen.getByRole('button', { name: 'عدة أشهر' }));

    expect(screen.getByRole('dialog', { name: /الفترة/i })).toBeTruthy();
    expect(screen.getAllByText(/Apr 2026 - Jun 2026|[A-Z][a-z]{2} 2026 - [A-Z][a-z]{2} 2026/).length).toBeGreaterThan(0);
  });
});
