import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import { DateField, DateFilterMonthPicker, DateMonthScopePicker, DateRangeField, getGregorianMonthNames } from './index';

afterEach(() => {
  cleanup();
});

describe('Noorix date fields', () => {
  it('uses the Noorix calendar instead of a native date input and emits plain YYYY-MM-DD values', () => {
    const onValueChange = vi.fn();
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <DateField aria-label="date" lang="en" value="2026-07-04" onValueChange={onValueChange} />
      </AppTestProviders>,
    );

    const trigger = screen.getByLabelText('date');
    expect(trigger.tagName).toBe('BUTTON');
    expect(document.querySelector('input[type="date"]')).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '2026-07-05' }));

    expect(onValueChange).toHaveBeenCalledWith('2026-07-05');
  });

  it('navigates calendar months without committing a new date until a day is selected', () => {
    const onValueChange = vi.fn();
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <DateField aria-label="date" lang="en" value="2026-07-04" onValueChange={onValueChange} />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByLabelText('date'));
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '8' } });

    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '2026-08-06' }));

    expect(onValueChange).toHaveBeenCalledWith('2026-08-06');
  });

  it('keeps blocked days disabled when min and max boundaries are present', () => {
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <DateField aria-label="date" lang="en" value="2026-07-04" min="2026-07-04" max="2026-07-06" />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByLabelText('date'));

    expect(screen.getByRole('button', { name: '2026-07-03' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '2026-07-07' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps range values and min boundary explicit', () => {
    const onStartChange = vi.fn();
    const onEndChange = vi.fn();
    render(
      <DateRangeField
        startAriaLabel="from"
        endAriaLabel="to"
        startValue="2026-07-01"
        endValue="2026-07-04"
        minEnd="2026-07-01"
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('from'));
    fireEvent.click(screen.getByRole('button', { name: '2026-07-02' }));
    fireEvent.click(screen.getByLabelText('to'));
    fireEvent.click(screen.getByRole('button', { name: '2026-07-06' }));

    expect(onStartChange).toHaveBeenCalledWith('2026-07-02');
    expect(onEndChange).toHaveBeenCalledWith('2026-07-06');
  });

  it('keeps the month picker behavior behind the central date export', () => {
    const onChange = vi.fn();
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <DateFilterMonthPicker year={2026} month={7} onChange={onChange} years={[2025, 2026]} />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));

    expect(onChange).toHaveBeenCalledWith({ year: 2026, month: 1 });
  });

  it('centralizes Arabic Gregorian month labels without mojibake literals', () => {
    const months = getGregorianMonthNames('ar');

    expect(months).toHaveLength(12);
    expect(months.join(' ')).not.toContain('ظ');
  });

  it('centralizes all/month/year scope changes for screen filters', () => {
    const onYearChange = vi.fn();
    const onMonthChange = vi.fn();
    function Harness() {
      const [year, setYear] = useState(2026);
      const [month, setMonth] = useState('');
      return (
        <DateMonthScopePicker
          year={year}
          years={[2025, 2026]}
          month={month}
          allowAll
          allowYear={false}
          fallbackMonth={7}
          onYearChange={(value) => {
            setYear(value);
            onYearChange(value);
          }}
          onMonthChange={(value) => {
            setMonth(value);
            onMonthChange(value);
          }}
        />
      );
    }

    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <Harness />
      </AppTestProviders>,
    );

    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByRole('button', { name: 'All months' }));

    expect(onYearChange).toHaveBeenCalledWith(2025);
    expect(onMonthChange).toHaveBeenCalledWith('7');
    expect(onMonthChange).toHaveBeenCalledWith('');
  });
});
