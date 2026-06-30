import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DateFilterBar, { useDateFilter } from './DateFilterBar';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';

function Harness() {
  const filter = useDateFilter();
  return <DateFilterBar filter={filter} />;
}

afterEach(() => {
  cleanup();
});

describe('DateFilterBar', () => {
  it('keeps month filtering in one control and supports multi-month selection', () => {
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <Harness />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(4);

    fireEvent.change(selects[3], { target: { value: '8' } });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/Jun 2026 - Aug 2026/)).toBeTruthy();
  });
});
