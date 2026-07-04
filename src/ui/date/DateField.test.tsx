import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import { DateField, DateFilterMonthPicker, DateRangeField, getGregorianMonthNames } from './index';

describe('Noorix date fields', () => {
  it('emits plain YYYY-MM-DD values', () => {
    const onValueChange = vi.fn();
    render(<DateField aria-label="date" value="2026-07-04" onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText('date'), { target: { value: '2026-07-05' } });

    expect(onValueChange).toHaveBeenCalledWith('2026-07-05');
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

    expect(screen.getByLabelText('to').getAttribute('min')).toBe('2026-07-01');
    fireEvent.change(screen.getByLabelText('from'), { target: { value: '2026-07-02' } });
    fireEvent.change(screen.getByLabelText('to'), { target: { value: '2026-07-06' } });

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
});
