import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DateFilterBar, { useDateFilter } from './DateFilterBar';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import { getSaudiNow } from '../../utils/saudiDate';

const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

    const now = getSaudiNow();
    const startMonth = Math.max(1, now.month - 1);
    const expectedLabel = `${MONTH_NAMES_EN[startMonth - 1]} ${now.year} - ${MONTH_NAMES_EN[now.month - 1]} ${now.year}`;

    fireEvent.change(selects[1], { target: { value: String(startMonth) } });
    fireEvent.change(selects[3], { target: { value: String(now.month) } });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(expectedLabel)).toBeTruthy();
  });
});
