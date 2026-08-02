import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Bootstrap } from '../../../types/api';
import { OrdersV4DocumentsTab } from './OrdersV4DocumentsTab';

vi.mock('../useOrdersV4', () => ({
  useOrdersV4Documents: () => ({ data: [], isLoading: false, error: null }),
  useOrdersV4Summary: () => ({ data: undefined }),
  useCreateOrdersV4Document: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReceiveOrdersV4Document: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReverseOrdersV4Document: () => ({ isPending: false, mutate: vi.fn() }),
}));

const bootstrap = {
  items: [],
  units: [],
  sections: [],
  locations: [{
    id: 'location-1',
    code: 'main',
    nameAr: 'المخزون الرئيسي',
    kind: 'central',
    isActive: true,
  }],
} as unknown as OrdersV4Bootstrap;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 900px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('OrdersV4DocumentsTab mobile document workflow', () => {
  it.each([
    ['purchase', '+ طلب جديد', 'طلب شراء جديد — طلبات V4'],
    ['registration', '+ تسجيل جديد', 'تسجيل داخلي جديد — طلبات V4'],
  ] as const)('opens %s creation as a full-height adaptive sheet on mobile', (documentType, triggerLabel, title) => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType={documentType}
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
        canCreate
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: triggerLabel }));

    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog.className).toContain('h-full');
    expect(dialog.className).toContain('w-[min(100vw,920px)]');
    expect(dialog.className).not.toContain('max-h-[min(92vh,860px)]');
  });
});
