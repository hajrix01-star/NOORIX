import Decimal from 'decimal.js';
import { useEffect, useMemo, useState } from 'react';
import { PERMISSIONS, hasPermission } from '../../../constants/permissions';
import { useAuth } from '../../../context/AuthContext';
import { useOrderSections, useOrdersRecipeInventoryStock } from '../../../hooks/useOrders';
import type { OrderRecipeInventoryStockRow, OrderSection } from '../../../types/api';
import { Badge, Button, SimpleTable, Spinner, useIsNarrow700 } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';
import InventoryStocktakeSheet from './InventoryStocktakeSheet';

type InventoryCostTabProps = {
  companyId: string;
  startDate?: string;
  endDate?: string;
  dateFilter?: unknown;
};

type SectionOption = {
  id: string;
  label: string;
  count: number;
};

type StockStatus = {
  label: string;
  color: 'green' | 'amber' | 'red' | 'gray';
};

type StocktakeSheetMode = 'create' | 'history';

const ALL_SECTIONS = 'all';
const UNCATEGORIZED_SECTION = '__uncategorized';

function decimalOrZero(value: unknown): Decimal {
  try {
    const parsed = new Decimal(String(value ?? 0));
    return parsed.isFinite() ? parsed : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

function formatQuantity(value: unknown, maximumFractionDigits = 3): string {
  const parsed = decimalOrZero(value);
  const fractionDigits = Math.min(parsed.decimalPlaces(), maximumFractionDigits);
  const fixed = parsed.toDecimalPlaces(fractionDigits, Decimal.ROUND_HALF_UP).toFixed(fractionDigits);
  const [signedInteger, fraction] = fixed.split('.');
  const sign = signedInteger.startsWith('-') ? '-' : '';
  const integer = sign ? signedInteger.slice(1) : signedInteger;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

function sectionLabel(section: OrderSection | undefined, fallback = 'قسم'): string {
  return section?.nameAr || section?.nameEn || fallback;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function rowSectionPairs(
  row: OrderRecipeInventoryStockRow,
  sectionsById: Map<string, OrderSection>,
): SectionOption[] {
  const sectionIds = uniqueStrings(row.sectionIds);
  if (sectionIds.length > 0) {
    return sectionIds.map((sectionId, index) => ({
      id: sectionId,
      label: sectionLabel(sectionsById.get(sectionId), row.sections[index] || sectionId),
      count: 1,
    }));
  }

  return uniqueStrings(row.sections).map((label) => ({
    id: `name:${label}`,
    label,
    count: 1,
  }));
}

function rowSectionLabels(
  row: OrderRecipeInventoryStockRow,
  sectionsById: Map<string, OrderSection>,
): string[] {
  const labels = rowSectionPairs(row, sectionsById).map((section) => section.label);
  return labels.length > 0 ? labels : ['بدون قسم'];
}

function buildSectionOptions(
  rows: OrderRecipeInventoryStockRow[],
  sections: OrderSection[],
): SectionOption[] {
  const byId = new Map<string, SectionOption>();
  const sectionsById = new Map(sections.map((section) => [section.id, section]));

  for (const row of rows) {
    const rowSections = rowSectionPairs(row, sectionsById);
    if (rowSections.length === 0) {
      const existing = byId.get(UNCATEGORIZED_SECTION);
      byId.set(UNCATEGORIZED_SECTION, {
        id: UNCATEGORIZED_SECTION,
        label: 'بدون قسم',
        count: (existing?.count ?? 0) + 1,
      });
      continue;
    }

    rowSections.forEach((section) => {
      const existing = byId.get(section.id);
      byId.set(section.id, {
        id: section.id,
        label: section.label,
        count: (existing?.count ?? 0) + 1,
      });
    });
  }

  const options = Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  return [{ id: ALL_SECTIONS, label: 'كل الأقسام', count: rows.length }, ...options];
}

function rowMatchesSection(row: OrderRecipeInventoryStockRow, sectionId: string): boolean {
  if (sectionId === ALL_SECTIONS) return true;
  const rowSectionIds = uniqueStrings(row.sectionIds);
  const rowSections = uniqueStrings(row.sections);
  if (sectionId === UNCATEGORIZED_SECTION) {
    return rowSectionIds.length === 0 && rowSections.length === 0;
  }
  if (sectionId.startsWith('name:')) {
    return rowSections.includes(sectionId.slice(5));
  }
  return rowSectionIds.includes(sectionId);
}

function stockStatus(row: OrderRecipeInventoryStockRow): StockStatus {
  const balance = decimalOrZero(row.balanceBaseQuantity);
  const consumed = decimalOrZero(row.consumedBaseQuantity);
  const purchased = decimalOrZero(row.purchasedBaseQuantity);
  const adjustments = decimalOrZero(row.adjustmentBaseQuantity);
  if (balance.isNegative()) return { label: 'عجز', color: 'red' };
  if (balance.isZero() && (consumed.isPositive() || purchased.isPositive() || !adjustments.isZero())) {
    return { label: 'نفد', color: 'amber' };
  }
  if (purchased.isZero() && consumed.isZero() && adjustments.isZero()) {
    return { label: 'بدون حركة', color: 'gray' };
  }
  return { label: 'متوفر', color: 'green' };
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'green' | 'red' | 'amber' | 'neutral';
}) {
  const toneClass = {
    green: 'text-emerald-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
    neutral: 'text-noorix-text',
  }[tone];

  return (
    <div className="rounded-md border border-noorix-border bg-white px-3 py-3 text-center shadow-sm">
      <div className="text-[12px] font-semibold text-noorix-muted">{label}</div>
      <div className={`mt-1 text-[20px] font-extrabold ${toneClass}`}>{value}</div>
    </div>
  );
}

function MobileStockCard({
  row,
  sectionsById,
}: {
  row: OrderRecipeInventoryStockRow;
  sectionsById: Map<string, OrderSection>;
}) {
  const status = stockStatus(row);
  const adjustment = decimalOrZero(row.adjustmentBaseQuantity);
  return (
    <article className="rounded-md border border-noorix-border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-right">
          <div className="truncate text-[14px] font-extrabold text-noorix-text">{row.productNameAr}</div>
          {row.productNameEn ? <div className="truncate text-[11px] text-noorix-muted">{row.productNameEn}</div> : null}
        </div>
        <Badge color={status.color} size="sm">{status.label}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {rowSectionLabels(row, sectionsById).map((label) => <Badge key={label} color="gray" size="sm">{label}</Badge>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[12px]">
        <div className="rounded bg-noorix-bg-muted px-2 py-2"><div className="text-noorix-muted">الوارد</div><strong className="text-emerald-700">{formatQuantity(row.purchasedBaseQuantity)}</strong></div>
        <div className="rounded bg-noorix-bg-muted px-2 py-2"><div className="text-noorix-muted">المستهلك</div><strong className="text-amber-700">{formatQuantity(row.consumedBaseQuantity)}</strong></div>
        <div className="rounded bg-noorix-bg-muted px-2 py-2"><div className="text-noorix-muted">تسويات الجرد</div><strong className={adjustment.isNegative() ? 'text-red-700' : adjustment.isPositive() ? 'text-emerald-700' : 'text-noorix-muted'}>{formatQuantity(adjustment)}</strong></div>
        <div className="rounded bg-noorix-bg-muted px-2 py-2"><div className="text-noorix-muted">المتبقي</div><strong className={decimalOrZero(row.balanceBaseQuantity).isNegative() ? 'text-red-700' : 'text-emerald-800'}>{formatQuantity(row.balanceBaseQuantity)} {row.unit}</strong></div>
      </div>
    </article>
  );
}

export function InventoryCostTab({ companyId }: InventoryCostTabProps) {
  const { user } = useAuth();
  const narrow = useIsNarrow700();
  const canWriteInventory = hasPermission(user?.role, PERMISSIONS.ORDERS_WRITE, user?.permissions);
  const [selectedSectionId, setSelectedSectionId] = useState(ALL_SECTIONS);
  const [stocktakeSheetMode, setStocktakeSheetMode] = useState<StocktakeSheetMode | null>(null);
  const stockQuery = useOrdersRecipeInventoryStock(companyId);
  const sectionsQuery = useOrderSections(companyId);

  const rows = stockQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];
  const sectionsById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const sectionOptions = useMemo(() => buildSectionOptions(rows, sections), [rows, sections]);
  const visibleRows = useMemo(
    () => rows.filter((row) => rowMatchesSection(row, selectedSectionId)),
    [rows, selectedSectionId],
  );

  useEffect(() => {
    if (!sectionOptions.some((option) => option.id === selectedSectionId)) setSelectedSectionId(ALL_SECTIONS);
  }, [sectionOptions, selectedSectionId]);

  const summary = useMemo(() => {
    return visibleRows.reduce((total, row) => {
      const status = stockStatus(row);
      return {
        items: total.items + 1,
        available: total.available + (status.label === 'متوفر' ? 1 : 0),
        depleted: total.depleted + (status.label === 'نفد' ? 1 : 0),
        shortage: total.shortage + (status.label === 'عجز' ? 1 : 0),
        adjusted: total.adjusted + (!decimalOrZero(row.adjustmentBaseQuantity).isZero() ? 1 : 0),
      };
    }, { items: 0, available: 0, depleted: 0, shortage: 0, adjusted: 0 });
  }, [visibleRows]);

  const unitsCount = useMemo(() => new Set(visibleRows.map((row) => row.unit).filter(Boolean)).size, [visibleRows]);

  const columns = useMemo<SimpleTableColumn<OrderRecipeInventoryStockRow>[]>(() => [
    {
      key: 'productNameAr',
      label: 'المادة',
      minWidth: 190,
      align: 'center',
      render: (_value, row) => (
        <div className="text-center">
          <div className="font-extrabold text-noorix-text">{row.productNameAr}</div>
          {row.productNameEn ? <div className="mt-1 text-[11px] text-noorix-muted">{row.productNameEn}</div> : null}
        </div>
      ),
    },
    { key: 'unit', label: 'الوحدة', width: 90, align: 'center' },
    { key: 'purchasedBaseQuantity', label: 'الوارد', width: 110, numeric: true, align: 'center', render: (value) => <strong className="text-emerald-700">{formatQuantity(value)}</strong> },
    { key: 'consumedBaseQuantity', label: 'المستهلك', width: 110, numeric: true, align: 'center', render: (value) => <strong className="text-amber-700">{formatQuantity(value)}</strong> },
    {
      key: 'adjustmentBaseQuantity',
      label: 'التسويات',
      width: 110,
      numeric: true,
      align: 'center',
      render: (value) => {
        const adjustment = decimalOrZero(value);
        const color = adjustment.isPositive() ? 'text-emerald-700' : adjustment.isNegative() ? 'text-red-700' : 'text-noorix-muted';
        return <strong className={color}>{formatQuantity(value)}</strong>;
      },
    },
    {
      key: 'balanceBaseQuantity',
      label: 'المتبقي',
      width: 120,
      numeric: true,
      align: 'center',
      render: (value) => <strong className={decimalOrZero(value).isNegative() ? 'text-red-700' : 'text-emerald-800'}>{formatQuantity(value)}</strong>,
    },
    {
      key: 'productId',
      label: 'الحالة',
      width: 100,
      align: 'center',
      render: (_value, row) => {
        const status = stockStatus(row);
        return <Badge color={status.color} size="sm">{status.label}</Badge>;
      },
    },
  ], []);

  if (stockQuery.isLoading) return <Spinner.Page label="جاري تحميل المخزون..." />;

  if (stockQuery.error) {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-5 text-center">
        <div className="font-bold text-red-700">تعذر تحميل رصيد المخزون.</div>
        <Button className="mt-3" size="sm" onClick={() => stockQuery.refetch()}>إعادة المحاولة</Button>
      </div>
    );
  }

  return (
    <section className="space-y-4" dir="rtl">
      <div className="rounded-md border border-noorix-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 text-right">
            <Badge color="green" size="sm">رصيد حالي</Badge>
            <h2 className="text-[19px] font-extrabold text-noorix-text sm:text-[22px]">المخزون والجرد</h2>
            <p className="text-[13px] leading-6 text-noorix-muted sm:text-[14px]">
              الرصيد = الوارد من الطلبات - استهلاك الرسبي + تسويات الجرد.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            {canWriteInventory ? <Button variant="success" onClick={() => setStocktakeSheetMode('create')}>جرد المخزون</Button> : null}
            <Button onClick={() => setStocktakeSheetMode('history')}>سجل الجرد</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <SummaryTile label="المواد" value={String(summary.items)} />
        <SummaryTile label="متوفر" value={String(summary.available)} tone="green" />
        <SummaryTile label="نفد" value={String(summary.depleted)} tone="amber" />
        <SummaryTile label="عجز" value={String(summary.shortage)} tone={summary.shortage > 0 ? 'red' : 'neutral'} />
        <SummaryTile label="مواد مسواة" value={String(summary.adjusted)} />
        <SummaryTile label="وحدات المخزون" value={String(unitsCount)} />
      </div>

      <div className="rounded-md border border-noorix-border bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-2 text-right text-[13px] font-extrabold text-noorix-text">فلترة حسب القسم</div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible">
          {sectionOptions.map((option) => {
            const active = option.id === selectedSectionId;
            return (
              <Button
                key={option.id}
                type="button"
                variant="raw"
                size="auto"
                onClick={() => setSelectedSectionId(option.id)}
                className={`shrink-0 rounded-md border px-3 py-2 text-[12px] font-extrabold transition ${active ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-noorix-border bg-white text-noorix-text'}`}
                aria-pressed={active}
              >
                {option.label} <span className="ms-1 text-noorix-muted">{option.count}</span>
              </Button>
            );
          })}
        </div>
        {sectionsQuery.error ? (
          <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <span>تعذر تحميل أسماء الأقسام؛ الرصيد نفسه ما زال متاحاً.</span>
            <Button type="button" variant="ghost" size="sm" className="font-bold underline" onClick={() => sectionsQuery.refetch()}>إعادة المحاولة</Button>
          </div>
        ) : null}
      </div>

      {narrow ? (
        visibleRows.length > 0 ? (
          <div className="space-y-2">
            {visibleRows.map((row) => <MobileStockCard key={row.productId} row={row} sectionsById={sectionsById} />)}
          </div>
        ) : <div className="rounded-md border border-dashed border-noorix-border p-8 text-center text-noorix-muted">لا توجد مواد مخزون مطابقة للفلتر.</div>
      ) : (
        <SimpleTable
          columns={columns}
          data={visibleRows}
          tableMinWidth={830}
          stickyHeader
          emptyMessage="لا توجد مواد مخزون مطابقة للفلتر."
          frameClassName="shadow-sm"
        />
      )}

      {stocktakeSheetMode ? (
        <InventoryStocktakeSheet
          companyId={companyId}
          mode={stocktakeSheetMode}
          open
          onClose={() => setStocktakeSheetMode(null)}
          currentRows={visibleRows}
          allRows={rows}
          currentSectionLabel={sectionOptions.find((option) => option.id === selectedSectionId)?.label || 'القسم الحالي'}
        />
      ) : null}
    </section>
  );
}

export default InventoryCostTab;
