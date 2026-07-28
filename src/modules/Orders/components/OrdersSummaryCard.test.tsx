import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrdersSummaryCard } from './OrdersSummaryCard';

vi.mock('../../../i18n/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => ({ loading: 'جاري التحميل...', retry: 'إعادة المحاولة' })[key] ?? key,
  }),
}));

afterEach(cleanup);

describe('OrdersSummaryCard request states', () => {
  it('shows the loading state only while the summary request is pending', () => {
    render(<OrdersSummaryCard isLoading />);

    expect(screen.getByText('جاري التحميل...')).toBeTruthy();
  });

  it('replaces loading with a recoverable error state after a failed request', () => {
    const onRetry = vi.fn();
    render(
      <OrdersSummaryCard
        errorMessage="تعذر تحميل ملخص الطلبات"
        onRetry={onRetry}
      />,
    );

    expect(screen.queryByText('جاري التحميل...')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('تعذر تحميل ملخص الطلبات');
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
