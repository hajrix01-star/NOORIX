import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Bootstrap, OrdersV4Item } from '../../../types/api';
import { OrdersV4DocumentLinesTable } from './OrdersV4DocumentLinesTable';
import { OrdersV4DocumentsTab } from './OrdersV4DocumentsTab';

const ordersV4DocumentsMock = vi.hoisted(() => ({ documents: [] as unknown[] }));
const previewDocumentMock = vi.hoisted(() => vi.fn());
const reopenDocumentMock = vi.hoisted(() => vi.fn());
const receiveDocumentMock = vi.hoisted(() => vi.fn());
const reverseDocumentMock = vi.hoisted(() => vi.fn());
const undoReverseDocumentMock = vi.hoisted(() => vi.fn());

vi.mock('../../../i18n/useTranslation', async () => {
  const translations = await vi.importActual<typeof import('../../../i18n/translations')>('../../../i18n/translations');
  return { useTranslation: () => ({
    lang: 'ar',
    t: (key: string, ...replacements: Array<string | number>) => translations.getText(key, 'ar', ...replacements),
  }) };
});

vi.mock('../useOrdersV4', () => ({
  useOrdersV4Documents: () => ({ data: ordersV4DocumentsMock.documents, isLoading: false, error: null }),
  useOrdersV4Summary: () => ({ data: undefined }),
  useCreateOrdersV4Document: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePreviewOrdersV4Document: () => ({ isPending: false, mutateAsync: previewDocumentMock }),
  useReceiveOrdersV4Document: () => ({ isPending: false, mutateAsync: receiveDocumentMock }),
  useReverseOrdersV4Document: () => ({ isPending: false, mutateAsync: reverseDocumentMock }),
  useUndoReverseOrdersV4Document: () => ({ isPending: false, mutateAsync: undoReverseDocumentMock }),
  useReopenOrdersV4Document: () => ({ isPending: false, mutateAsync: reopenDocumentMock }),
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
  ordersV4DocumentsMock.documents = [];
  previewDocumentMock.mockReset();
  reopenDocumentMock.mockReset();
  receiveDocumentMock.mockReset();
  reverseDocumentMock.mockReset();
  undoReverseDocumentMock.mockReset();
  previewDocumentMock.mockResolvedValue({ data: {
    kernelVersion: 4, calculationVersion: 1, lineCount: 1, totalAmount: '15',
    lines: [{ lineNumber: 1, itemId: 'item-1', itemName: 'معسل', lineTotal: '15' }],
  } });
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
  it('shows the total registered quantity instead of the line count in internal registration', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'registration-1', documentNumber: 'REG4-1', documentType: 'registration', documentDate: '2026-08-03',
      subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'received',
      lines: [
        { id: 'line-1', inputQuantity: '2.5', cancellationReasons: [] },
        { id: 'line-2', inputQuantity: '1.5', cancellationReasons: [] },
      ],
    }];

    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="registration"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
        showOverviewCards={false}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'الكمية' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'الأسطر' })).toBeNull();
    expect(screen.getByRole('cell', { name: '4' })).toBeTruthy();
  });

  it('removes purchase filters and keeps only the section filter for internal registration', () => {
    const purchase = render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="purchase"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
      />,
    );

    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryByRole('group', { name: 'فلترة طريقة الدفع' })).toBeNull();
    purchase.unmount();

    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="registration"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
      />,
    );

    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'كل الأقسام' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'كل الفئات' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'كل الأصناف' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'كل الحالات' })).toBeNull();
  });

  it('renders the purchase period summary as cards rather than a table', () => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="purchase"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
      />,
    );

    const summaryCards = screen.getByTestId('orders-v4-purchase-summary-cards');
    expect(summaryCards.querySelectorAll('article')).toHaveLength(2);
    expect(summaryCards.querySelector('table')).toBeNull();
  });

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

    const trigger = screen.getByRole('button', { name: triggerLabel });
    const toolbar = screen.getByRole('toolbar', { name: documentType === 'purchase' ? 'إجراءات الطلبات' : 'إجراءات التسجيل الداخلي' });
    expect(toolbar.contains(trigger)).toBe(true);
    expect(trigger.closest('section')).toBeNull();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog.className).toContain('h-full');
    expect(dialog.className).toContain('w-[min(100vw,920px)]');
    expect(dialog.className).not.toContain('max-h-[min(92vh,860px)]');
    expect(screen.queryByLabelText('موقع المخزون')).toBeNull();
  });

  it('requires an explicit document date while keeping the date control editable', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'registration-10', documentNumber: 'REG4-10', documentType: 'registration',
      documentDate: '2026-08-10T00:00:00.000Z', subtotal: '0', totalAmount: '0',
      operationalCost: '0', status: 'received', lines: [],
    }];

    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="registration"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canCreate
    />);

    fireEvent.click(screen.getByRole('button', { name: /تسجيل جديد/ }));
    const dateButton = screen.getByRole('button', { name: 'التاريخ' });
    expect(dateButton.getAttribute('title')).toBe('');
    expect(dateButton.getAttribute('aria-haspopup')).toBe('dialog');
    expect(dateButton.hasAttribute('disabled')).toBe(false);
  });

  it('opens document details as a full-height adaptive sheet on mobile', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'document-1',
      documentNumber: 'REQ4-20260803-001',
      documentType: 'purchase',
      documentDate: '2026-08-03',
      paymentMethod: 'custody',
      pettyCashAmount: '100',
      subtotal: '12',
      totalAmount: '12',
      operationalCost: '12',
      status: 'received',
      lines: [{
        id: 'line-1', lineNumber: 1, itemId: 'item-1', itemNameSnapshot: 'سكر',
        inputQuantity: '1', baseQuantity: '1', unitPrice: '12', lineTotal: '12', operationalCost: '12',
        inputUnit: { id: 'unit-1', nameAr: 'كرتون' },
        baseUnit: { id: 'unit-2', nameAr: 'حبة' },
        priceUnit: { id: 'unit-1', nameAr: 'كرتون' },
      }],
    }];

    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="purchase"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
      />,
    );

    fireEvent.click(screen.getByText('REQ4-20260803-001'));
    const dialog = screen.getByRole('dialog', { name: 'REQ4-20260803-001' });
    expect(dialog.className).toContain('h-full');
    expect(dialog.className).toContain('w-[min(100vw,920px)]');
    expect(dialog.className).not.toContain('max-h-[min(92vh,860px)]');
  });

  it('opens the receipt editor directly from the status cell', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'prepared-1', documentNumber: 'REQ4-PREPARED', documentType: 'purchase', documentDate: '2026-08-03',
      paymentMethod: 'custody', subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'prepared', canReceive: true, lines: [],
    }];

    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canReceive
    />);

    expect(screen.getAllByRole('columnheader').every((header) => header.textContent?.trim())).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '\u0627\u0633\u062a\u0644\u0627\u0645 \u0648\u062a\u0639\u062f\u064a\u0644' }));
    expect(screen.getByRole('dialog', { name: '\u0627\u0633\u062a\u0644\u0627\u0645 \u0648\u062a\u0639\u062f\u064a\u0644 REQ4-PREPARED' })).toBeTruthy();
  });

  it('does not offer receipt for a prepared purchase outside the server-authorized latest-five window', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'prepared-6', documentNumber: 'REQ4-PREPARED-6', documentType: 'purchase', documentDate: '2026-08-03',
      paymentMethod: 'custody', subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'prepared', canReceive: false, lines: [],
    }];

    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canReceive
    />);

    expect(screen.queryByRole('button', { name: '\u0627\u0633\u062a\u0644\u0627\u0645 \u0648\u062a\u0639\u062f\u064a\u0644' })).toBeNull();
  });

  it('keeps reversal controls inside document details and marks reversed rows with a full red strike', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'reversed-1', documentNumber: 'REQ4-REVERSED', documentType: 'purchase', documentDate: '2026-08-03',
      paymentMethod: 'custody', subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'reversed', lines: [],
    }];

    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canUndoReverse
    />);

    expect(screen.queryByText('REQ4-REVERSED')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: '\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0645\u0644\u063a\u0627\u0629' }));
    expect(screen.queryByRole('button', { name: '\u0627\u0633\u062a\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628' })).toBeNull();
    const row = screen.getByText('REQ4-REVERSED').closest('tr');
    expect(row?.className).toContain('orders-v4-document-row--reversed');
    fireEvent.click(screen.getByText('REQ4-REVERSED'));
    expect(screen.getByRole('button', { name: 'استعادة الطلب' })).toBeTruthy();
  });

  it('shows reverse only after opening a received document', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'received-1', documentNumber: 'REQ4-RECEIVED', documentType: 'purchase', documentDate: '2026-08-03',
      paymentMethod: 'custody', subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'received', lines: [],
    }];

    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canReverse
    />);

    expect(screen.queryByRole('button', { name: 'إلغاء الطلب' })).toBeNull();
    fireEvent.click(screen.getByText('REQ4-RECEIVED'));
    expect(screen.getByRole('button', { name: 'إلغاء الطلب' })).toBeTruthy();
  });

  it.skip('shows the owner-only warning for the retired 7-day/latest-five rule', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'document-1', documentNumber: 'REQ4-1', documentType: 'purchase', documentDate: '2026-08-03',
      paymentMethod: 'custody', subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'received', canReopen: true, lines: [],
    }];
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="purchase"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
        canReopen
      />,
    );

    expect(screen.queryByRole('button', { name: 'تعديل الطلب' })).toBeNull();
    fireEvent.click(screen.getByText('REQ4-1'));
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الطلب' }));
    expect(screen.getByRole('dialog', { name: 'تعديل الطلب' })).toBeTruthy();
    expect(screen.getByText(/سيفتح الطلب للتعديل دون تغيير المخزون أو العهدة/)).toBeTruthy();
    expect(screen.getByText(/خلال آخر 7 أيام، وكذلك ضمن آخر 5 طلبات/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'فتح للتعديل' })).toBeTruthy();
  });

  it.skip('explains the retired cashier latest-five purchase window', () => {
    ordersV4DocumentsMock.documents = [{
      id: 'document-1', documentNumber: 'REQ4-1', documentType: 'purchase', documentDate: '2026-08-03',
      paymentMethod: 'custody', subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'received', canReopen: true, lines: [],
    }];
    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canReopen
      reopenAsCashier
    />);

    fireEvent.click(screen.getByText('REQ4-1'));
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الطلب' }));
    expect(screen.getByText(/آخر 5 طلبات شراء، سواء كانت بانتظار الاستلام أو مستلمة/)).toBeTruthy();
  });

  it('lets the owner delegate one received purchase to the cashier as awaiting receipt', async () => {
    const document = {
      id: 'old-document', documentNumber: 'REQ4-OLD', documentType: 'purchase', documentDate: '2020-01-01',
      paymentMethod: 'custody', subtotal: '12', totalAmount: '12', operationalCost: '12', status: 'received', canReopen: true, lines: [],
    };
    ordersV4DocumentsMock.documents = [document];
    reopenDocumentMock.mockResolvedValue({ data: { ...document, ownerReopenedForCashier: true, editMode: 'correction' } });
    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canReopen
      ownerReopenForStaff
    />);

    fireEvent.click(screen.getByText('REQ4-OLD'));
    fireEvent.click(screen.getByRole('button', { name: 'إعادة فتح للموظف' }));
    fireEvent.click(screen.getByRole('button', { name: '\u062a\u062d\u0648\u064a\u0644 \u0625\u0644\u0649 \u0637\u0644\u0628 \u062c\u0627\u0631\u064a' }));

    await waitFor(() => expect(reopenDocumentMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'old-document', reopenMode: 'delegate',
    })));
  });

  it('opens the same edit sheet when the server selects direct correction mode', async () => {
    const document = {
      id: 'document-1', documentNumber: 'REQ4-1', documentType: 'purchase', documentDate: '2026-08-03',
      paymentMethod: 'custody', pettyCashAmount: '20', subtotal: '12', totalAmount: '12', operationalCost: '12',
      status: 'received', revision: 2, locationId: 'location-1', canReopen: true, editMode: 'correction', lines: [],
    };
    ordersV4DocumentsMock.documents = [document];
    reopenDocumentMock.mockResolvedValue({ data: document });
    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={bootstrap}
      canReopen
      canReceive
    />);

    fireEvent.click(screen.getByText('REQ4-1'));
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الطلب' }));
    fireEvent.click(screen.getByRole('button', { name: 'فتح للتعديل' }));

    expect(await screen.findByRole('dialog', { name: 'تعديل REQ4-1' })).toBeTruthy();
    expect(reopenDocumentMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'document-1' }));
  });

  it('renders added document lines as one editable table without repeated field headings', () => {
    const item = {
      id: 'item-1',
      sku: 'M-1',
      nameAr: 'معسل',
      itemType: 'purchased',
      inventoryUnitId: 'unit-1',
      inventoryUnit: { id: 'unit-1', code: 'box', nameAr: 'علبة', dimension: 'count', decimalScale: 3, isActive: true },
      units: [{
        id: 'item-unit-1',
        unitId: 'unit-1',
        unit: { id: 'unit-1', code: 'box', nameAr: 'علبة', dimension: 'count', decimalScale: 3, isActive: true },
        isOrderEnabled: true,
        isActive: true,
        sortOrder: 0,
        lastPrice: '15',
      }],
      trackInventory: true,
      isActive: true,
      sections: [],
    } as unknown as OrdersV4Item;
    const onPatch = vi.fn();
    const onRemove = vi.fn();

    render(
      <OrdersV4DocumentLinesTable
        lines={[
          { key: 'line-1', itemId: item.id, quantity: '1', unitId: 'unit-1', unitPrice: '15', priceUnitId: 'unit-1' },
          { key: 'line-2', itemId: item.id, quantity: '2', unitId: 'unit-1', unitPrice: '15', priceUnitId: 'unit-1' },
        ]}
        items={[item]}
        isPurchase
        isReceiving={false}
        onPatch={onPatch}
        onRemove={onRemove}
      />,
    );

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'الصنف',
      'الكمية',
      'وحدة الإدخال',
      'سعر الوحدة',
      'وحدة السعر',
      'الإجراء',
    ]);
    expect(screen.getAllByText('الكمية')).toHaveLength(1);
    fireEvent.change(screen.getAllByRole('spinbutton', { name: 'كمية معسل' })[0], { target: { value: '3' } });
    expect(onPatch).toHaveBeenCalledWith('line-1', { quantity: '3' });
    fireEvent.click(screen.getAllByRole('button', { name: 'حذف معسل' })[1]);
    expect(onRemove).toHaveBeenCalledWith('line-2');
  });

  it('shows the kernel-calculated purchase total inside the creation sheet before saving', async () => {
    const item = {
      id: 'item-1', nameAr: 'معسل', itemType: 'purchased', inventoryUnitId: 'unit-1',
      inventoryUnit: { id: 'unit-1', code: 'box', nameAr: 'علبة', dimension: 'count', decimalScale: 3, isActive: true },
      units: [{
        id: 'item-unit-1', unitId: 'unit-1',
        unit: { id: 'unit-1', code: 'box', nameAr: 'علبة', dimension: 'count', decimalScale: 3, isActive: true },
        isOrderEnabled: true, isActive: true, sortOrder: 0, lastPrice: '15',
      }],
      trackInventory: true, isActive: true, sections: [],
    } as unknown as OrdersV4Item;

    render(<OrdersV4DocumentsTab
      companyId="company-1"
      documentType="purchase"
      startDate="2026-08-01"
      endDate="2026-08-31"
      bootstrap={{ ...bootstrap, items: [item] } as OrdersV4Bootstrap}
      canCreate
    />);

    fireEvent.click(screen.getByRole('button', { name: /طلب جديد/ }));
    fireEvent.click(screen.getByRole('button', { name: 'معسل' }));
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }));

    expect(screen.getByTestId('orders-v4-live-purchase-total').textContent).toContain('15');
    expect(screen.getByTestId('orders-v4-live-purchase-total').textContent).not.toContain('جارٍ الحساب');
    await waitFor(() => expect(previewDocumentMock).toHaveBeenCalledWith({
      lines: [{ itemId: 'item-1', quantity: '1', unitId: 'unit-1', unitPrice: '15', priceUnitId: 'unit-1' }],
    }));
    await waitFor(() => expect(screen.getByTestId('orders-v4-live-purchase-total').textContent).toContain('15'));
  });

  it('opens cancellation through the same internal-registration sheet', () => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="registration"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
        canCreate
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل إلغاء' }));
    expect(screen.getByRole('dialog', { name: 'تسجيل إلغاء — طلبات V4' })).toBeTruthy();
    expect(screen.getByText(/لا يرتبط السجل بتسجيل سابق/)).toBeTruthy();
  });

  it('hides internal-registration overview cards for a submit-only employee', () => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="registration"
        startDate="2026-07-28"
        endDate="2026-08-03"
        bootstrap={bootstrap}
        canCreate
        canReport={false}
        showOverviewCards={false}
        historyWindowDays={7}
      />,
    );

    expect(screen.queryByText('عدد التسجيلات')).toBeNull();
    expect(screen.getByText(/تسجيلاته الداخلية لآخر 7 أيام فقط/)).toBeTruthy();
  });
});
