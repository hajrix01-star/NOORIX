import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DateFilterBar, { useDateFilter } from './DateFilterBar';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import { getSaudiNow } from '../../utils/saudiDate';

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Harness() {
  const filter = useDateFilter();
  return (
    <>
      <div data-testid="applied-label">{filter.label}</div>
      <DateFilterBar filter={filter} />
    </>
  );
}

function renderFilter() {
  render(
    <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
      <Harness />
    </AppTestProviders>,
  );
}

afterEach(() => {
  cleanup();
});

describe('DateFilterBar', () => {
  it('keeps month filtering in one calendar control and supports multi-month selection', () => {
    renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    const now = getSaudiNow();
    const startMonth = Math.max(1, now.month - 1);
    const expectedLabel = `${MONTH_NAMES_EN[startMonth - 1]} ${now.year} - ${MONTH_NAMES_EN[now.month - 1]} ${now.year}`;

    fireEvent.click(screen.getByRole('button', { name: `From ${MONTH_NAMES_EN[startMonth - 1]}` }));
    fireEvent.click(screen.getByRole('button', { name: `To ${MONTH_NAMES_EN[now.month - 1]}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('applied-label').textContent).toBe(expectedLabel);
  });

  it('does not update the applied period until Apply is clicked', () => {
    renderFilter();

    const appliedLabel = screen.getByTestId('applied-label').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));

    expect(screen.getByTestId('applied-label').textContent).toBe(appliedLabel);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByTestId('applied-label').textContent).not.toBe(appliedLabel);
  });
});
