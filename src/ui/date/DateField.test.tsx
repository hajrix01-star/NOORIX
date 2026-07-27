import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import { DateField, DateRangeField, getGregorianMonthNames } from './index';

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
    fireEvent.click(screen.getByRole('button', { name: 'Choose month and year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aug 2026' }));

    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '2026-08-06' }));

    expect(onValueChange).toHaveBeenCalledWith('2026-08-06');
  });

  it('uses custom period controls instead of native selects', () => {
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <DateField aria-label="date" lang="en" value="2026-07-27" />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByLabelText('date'));

    const calendar = screen.getByTestId('date-picker-calendar');
    expect(calendar.querySelector('select')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose month and year' }).getAttribute('aria-expanded')).toBe('false');
  });

  it('supports RTL-aware keyboard navigation between day cells', () => {
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'ar' }}>
        <DateField aria-label="date" lang="ar" value="2026-07-27" />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByLabelText('date'));
    const selectedDay = screen.getByRole('button', { name: '2026-07-27' });
    selectedDay.focus();
    fireEvent.keyDown(selectedDay, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: '2026-07-26' }));
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
    expect(screen.getByRole('button', { name: 'Next month' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Choose month and year' }));
    expect(screen.getByRole('button', { name: 'Aug 2026' }).hasAttribute('disabled')).toBe(true);
  });

  it('renders an isolated seven-column calendar without shared Button or table layout styles', () => {
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <DateField aria-label="date" lang="en" value="2026-07-27" />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByLabelText('date'));

    const calendar = screen.getByTestId('date-picker-calendar');
    expect(calendar.querySelectorAll('[role="columnheader"]')).toHaveLength(7);
    expect(calendar.querySelectorAll('[data-calendar-grid]')).toHaveLength(1);
    expect(calendar.querySelectorAll('[data-calendar-slot]')).toHaveLength(35);
    expect(calendar.querySelectorAll('button[aria-label^="2026-07-"]')).toHaveLength(31);
    expect(calendar.querySelector('table')).toBeNull();
    expect(screen.getByRole('button', { name: '2026-07-27' }).className).not.toContain('inline-flex');
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

  it('centralizes Arabic Gregorian month labels without mojibake literals', () => {
    const months = getGregorianMonthNames('ar');

    expect(months).toHaveLength(12);
    expect(months.join(' ')).not.toContain('ظ');
  });
});
