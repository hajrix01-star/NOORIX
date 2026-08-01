import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InventoryDataQualityReport } from '../../../types/api';
import { InventoryDataQualityPanel } from './InventoryDataQualityPanel';

afterEach(cleanup);

const needsReviewQuality: InventoryDataQualityReport = {
  status: 'needs_review',
  checkedAt: '2026-08-01T12:00:00.000Z',
  legacy: {
    shishaSettingsRows: 1,
    shishaMovementRows: 5,
    shishaStocktakeRows: 2,
    shishaTotalRows: 8,
    purchaseItemsWithoutSnapshot: 1,
  },
  estimated: { saleItemsFromCurrentRecipe: 3 },
  snapshots: {
    purchases: { totalItems: 5, verifiedItems: 4, missingItems: 1 },
    consumption: { totalItems: 6, verifiedItems: 3, missingItems: 2, invalidItems: 1 },
  },
};

describe('InventoryDataQualityPanel', () => {
  it('shows review status and all fallback sources', () => {
    render(<InventoryDataQualityPanel quality={needsReviewQuality} />);

    expect(screen.getByText('تحتاج مراجعة')).toBeTruthy();
    expect(screen.getByText('صفوف Shisha محفوظة').parentElement?.textContent).toContain('8');
    expect(screen.getByText('مشتريات Legacy').parentElement?.textContent).toContain('1');
    expect(screen.getByText('مبيعات مقدرة').parentElement?.textContent).toContain('3');
    expect(screen.getByText('Snapshots مفقودة').parentElement?.textContent).toContain('3');
    expect(screen.getByText('Snapshots غير صالحة').parentElement?.textContent).toContain('1');
    expect(screen.getByText('Snapshots موثقة').parentElement?.textContent).toContain('7/11');
    expect(screen.getByText(/إعدادات 1، حركات 5، جرد 2/)).toBeTruthy();
  });

  it('keeps a failed quality request recoverable without replacing inventory content', () => {
    const onRetry = vi.fn();
    render(<InventoryDataQualityPanel error={new Error('failed')} onRetry={onRetry} />);

    expect(screen.getByRole('alert').textContent).toContain('تعذر التحقق من جودة بيانات المخزون');
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
