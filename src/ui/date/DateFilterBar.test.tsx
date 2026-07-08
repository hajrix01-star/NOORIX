import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import { getSaudiNow } from '../../utils/saudiDate';
import { DateFilterBar, MonthDateFilter, useDateFilter } from './index';

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

function ConfigurableHarness() {
  const filter = useDateFilter();
  return (
    <DateFilterBar
      filter={filter}
      modes={['month', 'range']}
      showActions={false}
      showBadge={false}
      className="test-date-filter"
    />
  );
}

function renderFilter() {
  render(
    <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
      <Harness />
    </AppTestProviders>,
  );
}

function renderConfigurableFilter() {
  render(
    <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
      <ConfigurableHarness />
    </AppTestProviders>,
  );
}

function MonthFilterHarness({ onChange }: { onChange: (value: { year: number; month: number }) => void }) {
  return <MonthDateFilter year={2026} month={7} onChange={onChange} />;
}

afterEach(() => {
  cleanup();
});

describe('DateFilterBar', () => {
  it('keeps month filtering in one calendar control and supports multi-month selection', () => {
    renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    const now = getSaudiNow();
    const startMonth = now.month > 1 ? now.month - 1 : now.month;
    const expectedLabel = startMonth === now.month
      ? `${MONTH_NAMES_EN[now.month - 1]} ${now.year}`
      : `${MONTH_NAMES_EN[startMonth - 1]} ${now.year} - ${MONTH_NAMES_EN[now.month - 1]} ${now.year}`;

    fireEvent.click(screen.getByRole('button', { name: MONTH_NAMES_EN[startMonth - 1] }));
    fireEvent.click(screen.getByRole('button', { name: MONTH_NAMES_EN[now.month - 1] }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('applied-label').textContent).toBe(expectedLabel);
    expect(screen.queryByRole('button', { name: MONTH_NAMES_EN[now.month - 1] })).toBeNull();
  });

  it('does not update the applied period until Apply is clicked', () => {
    renderFilter();

    const appliedLabel = screen.getByTestId('applied-label').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));

    expect(screen.getByTestId('applied-label').textContent).toBe(appliedLabel);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByTestId('applied-label').textContent).not.toBe(appliedLabel);
  });

  it('closes the compact period popover when clicking outside', () => {
    renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('dialog', { name: 'Period' })).toBeTruthy();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('dialog', { name: 'Period' })).toBeNull();
  });

  it('applies all mode immediately without opening the old inline panel', () => {
    renderFilter();

    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByTestId('applied-label').textContent).not.toBe('All');

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByTestId('applied-label').textContent).toBe('All');
    expect(screen.queryByRole('dialog', { name: 'Period' })).toBeNull();
  });

  it('supports selecting a day range from the day calendar', () => {
    renderFilter();

    const now = getSaudiNow();
    const startDate = `${now.year}-${String(now.month).padStart(2, '0')}-01`;
    const endDate = `${now.year}-${String(now.month).padStart(2, '0')}-03`;
    const expectedLabel = `01-${String(now.month).padStart(2, '0')}-${now.year} - 03-${String(now.month).padStart(2, '0')}-${now.year}`;

    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    fireEvent.click(screen.getByRole('button', { name: startDate }));
    fireEvent.click(screen.getByRole('button', { name: endDate }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByTestId('applied-label').textContent).toBe(expectedLabel);
    expect(screen.queryByRole('button', { name: startDate })).toBeNull();
  });

  it('supports selecting a year range from the year calendar', () => {
    renderFilter();

    const now = getSaudiNow();
    const startYear = now.year - 2;
    const endYear = now.year;
    const beforeApply = screen.getByTestId('applied-label').textContent;

    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    fireEvent.click(screen.getByRole('button', { name: String(startYear) }));
    fireEvent.click(screen.getByRole('button', { name: String(endYear) }));

    expect(screen.getByTestId('applied-label').textContent).toBe(beforeApply);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByTestId('applied-label').textContent).toBe(`${startYear} - ${endYear}`);
    expect(screen.queryByRole('button', { name: String(startYear) })).toBeNull();
  });

  it('supports selecting a quarter through the central period filter', () => {
    renderFilter();

    const now = getSaudiNow();
    fireEvent.click(screen.getByRole('button', { name: 'Quarter' }));
    fireEvent.click(screen.getByRole('button', { name: String(now.year) }));
    fireEvent.click(screen.getByRole('button', { name: 'Q3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByTestId('applied-label').textContent).toBe(`Q3 ${now.year}`);
    expect(screen.queryByRole('button', { name: 'Q3' })).toBeNull();
  });

  it('can limit visible modes without creating a custom date filter', () => {
    renderConfigurableFilter();

    expect(screen.getByRole('button', { name: 'Month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Range' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Year' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Day' })).toBeNull();
  });

  it('activates the first allowed mode when the current filter mode is not visible', () => {
    renderConfigurableFilter();

    expect(screen.getByRole('button', { name: 'Month' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('can hide actions and pending badge for composed filter layouts', () => {
    renderConfigurableFilter();

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(document.querySelector('.test-date-filter')).toBeTruthy();
    expect(document.querySelector('.ndfb-period-badge')).toBeNull();
  });

  it('lets the controlled month filter commit a user-selected month without snapping back to props first', () => {
    const onChange = vi.fn();
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <MonthFilterHarness onChange={onChange} />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onChange).toHaveBeenCalledWith({ year: 2026, month: 1 });
  });

  it('renders the controlled month filter with a stable applied badge instead of a pending draft badge', () => {
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <MonthFilterHarness onChange={() => {}} />
      </AppTestProviders>,
    );

    expect(document.querySelector('.ndfb-period-badge--applied')?.textContent).toBe('Jul 2026');
    expect(document.querySelector('.ndfb-period-badge--pending')).toBeNull();
  });

  it('does not emit duplicate controlled month changes for the same selected month', () => {
    const onChange = vi.fn();
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <MonthFilterHarness onChange={onChange} />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ year: 2026, month: 1 });
  });
});
