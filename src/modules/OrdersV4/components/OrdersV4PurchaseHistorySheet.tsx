import React, { useMemo } from 'react';
import type { OrdersV4Document } from '../../../types/api';
import { AdaptiveSheet, SimpleTable, type SimpleTableColumn } from '../../../ui';
import { v4Date, v4ReportNumber } from '../OrdersV4Shared';

type HistoryRow = {
  id: string;
  documentNumber: string;
  documentDate: string;
  itemName: string;
  categoryName: string;
  quantity: string;
  unitName: string;
  baseQuantity: string;
  baseUnitName: string;
  unitPrice: string;
  priceUnitName: string;
  total: string;
  sectionName: string;
  paymentMethod: string;
};

export function OrdersV4PurchaseHistorySheet({
  documents,
  itemId,
  categoryName,
  title,
  onClose,
}: {
  documents: OrdersV4Document[];
  itemId?: string;
  categoryName?: string;
  title: string;
  onClose: () => void;
}) {
  const rows = useMemo<HistoryRow[]>(() => documents
    .filter((document) => document.documentType === 'purchase' && document.status === 'received')
    .flatMap((document) => document.lines
      .filter((line) => itemId ? line.itemId === itemId : line.item.category?.nameAr === categoryName)
      .map((line) => ({
        id: line.id,
        documentNumber: document.documentNumber,
        documentDate: document.documentDate,
        itemName: line.itemNameSnapshot,
        categoryName: line.item.category?.nameAr || '—',
        quantity: line.inputQuantity,
        unitName: line.inputUnit.nameAr,
        baseQuantity: line.baseQuantity,
        baseUnitName: line.baseUnit.nameAr,
        unitPrice: line.unitPrice,
        priceUnitName: line.priceUnit.nameAr,
        total: line.lineTotal,
        sectionName: document.section?.nameAr || 'غير محدد',
        paymentMethod: document.paymentMethod === 'custody' ? 'عهدة' : document.paymentMethod === 'cash' ? 'نقد' : document.paymentMethod === 'transfer' ? 'تحويل' : '—',
      })))
    .sort((a, b) => b.documentDate.localeCompare(a.documentDate)), [categoryName, documents, itemId]);
  const columns: SimpleTableColumn<HistoryRow>[] = [
    { key: 'documentNumber', label: 'رقم الطلب', minWidth: 170 },
    { key: 'documentDate', label: 'التاريخ', render: (value) => v4Date(String(value)) },
    ...(!itemId ? [{ key: 'itemName', label: 'الصنف', minWidth: 150 } as SimpleTableColumn<HistoryRow>] : []),
    { key: 'quantity', label: 'الكمية المسجلة', numeric: true, render: (value, row) => `${v4ReportNumber(value)} ${row.unitName}` },
    { key: 'baseQuantity', label: 'الكمية المعيارية', numeric: true, render: (value, row) => `${v4ReportNumber(value)} ${row.baseUnitName}` },
    { key: 'unitPrice', label: 'سعر الوحدة', numeric: true, render: (value, row) => `${v4ReportNumber(value)} ر.س / ${row.priceUnitName}` },
    { key: 'total', label: 'الإجمالي', numeric: true, render: (value) => `${v4ReportNumber(value)} ر.س` },
    { key: 'sectionName', label: 'القسم' },
    { key: 'paymentMethod', label: 'الدفع' },
  ];
  return <AdaptiveSheet open onClose={onClose} title={`تاريخ الشراء — ${title}`} size="lg" side="start">
    <div className="mb-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2 text-[12px] text-noorix-muted">
      {rows.length} حركة شراء مستلمة ضمن الفترة المحددة
    </div>
    <SimpleTable columns={columns} data={rows} emptyMessage="لا يوجد تاريخ شراء ضمن الفترة" tableMinWidth={850} />
  </AdaptiveSheet>;
}
