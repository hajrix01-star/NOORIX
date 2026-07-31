import { useMemo, useState } from 'react';
import { useOrderSections, useOrdersRecipeInventoryStock } from '../../../hooks/useOrders';
import type { OrderRecipeInventoryStockRow, OrderSection } from '../../../types/api';
import { Badge, SimpleTable, Spinner } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';

type ShishaInventoryTabProps = {
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

const ALL_SECTIONS = 'all';
const UNCATEGORIZED_SECTION = '__uncategorized';

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: unknown): string {
  return toNumber(value).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
}

function sectionLabel(section: OrderSection | undefined, fallback = 'قسم'): string {
  return section?.nameAr || section?.nameEn || fallback;
}

function rowSectionLabels(
  row: OrderRecipeInventoryStockRow,
  sectionsById: Map<string, OrderSection>,
): string[] {
  const labels = row.sectionIds
    .map((sectionId, index) => sectionLabel(sectionsById.get(sectionId), row.sections[index] || sectionId))
    .filter(Boolean);
  const looseLabels = row.sections.filter((label) => label && !labels.includes(label));
  const merged = [...labels, ...looseLabels];
  return merged.length > 0 ? merged : ['بدون قسم'];
}

function buildSectionOptions(
  rows: OrderRecipeInventoryStockRow[],
  sections: OrderSection[],
): SectionOption[] {
  const byId = new Map<string, SectionOption>();
  const sectionsById = new Map(sections.map((section) => [section.id, section]));

  for (const row of rows) {
    if (row.sectionIds.length === 0 && row.sections.length === 0) {
      const existing = byId.get(UNCATEGORIZED_SECTION);
      byId.set(UNCATEGORIZED_SECTION, {
        id: UNCATEGORIZED_SECTION,
        label: 'بدون قسم',
        count: (existing?.count ?? 0) + 1,
      });
      continue;
    }

    row.sectionIds.forEach((sectionId, index) => {
      const existing = byId.get(sectionId);
      byId.set(sectionId, {
        id: sectionId,
        label: sectionLabel(sectionsById.get(sectionId), row.sections[index] || sectionId),
        count: (existing?.count ?? 0) + 1,
      });
    });

    row.sections
      .filter((label) => label && !row.sectionIds.includes(label))
      .forEach((label) => {
        const key = `name:${label}`;
        const existing = byId.get(key);
        byId.set(key, {
          id: key,
          label,
          count: (existing?.count ?? 0) + 1,
        });
      });
  }

  const options = Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, 'ar'));
  return [{ id: ALL_SECTIONS, label: 'كل الأقسام', count: rows.length }, ...options];
}

function rowMatchesSection(row: OrderRecipeInventoryStockRow, sectionId: string): boolean {
  if (sectionId === ALL_SECTIONS) return true;
  if (sectionId === UNCATEGORIZED_SECTION) {
    return row.sectionIds.length === 0 && row.sections.length === 0;
  }
  if (sectionId.startsWith('name:')) {
    return row.sections.includes(sectionId.slice(5));
  }
  return row.sectionIds.includes(sectionId);
}

function stockStatus(row: OrderRecipeInventoryStockRow): StockStatus {
  const balance = toNumber(row.balanceBaseQuantity);
  const consumed = toNumber(row.consumedBaseQuantity);
  const purchased = toNumber(row.purchasedBaseQuantity);
  if (balance < 0) return { label: 'عجز', color: 'red' };
  if (purchased === 0 && consumed === 0) return { label: 'بدون حركة', color: 'gray' };
  if (balance === 0 && consumed > 0) return { label: 'نفد', color: 'amber' };
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
    <div className="rounded-md border border-noorix-border bg-white p-4 text-center shadow-sm">
      <div className="text-[13px] font-semibold text-noorix-muted">{label}</div>
      <div className={`mt-2 text-[22px] font-extrabold ${toneClass}`}>{value}</div>
    </div>
  );
}

export function ShishaInventoryTab({ companyId }: ShishaInventoryTabProps) {
  const [selectedSectionId, setSelectedSectionId] = useState(ALL_SECTIONS);
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

  const summary = useMemo(() => {
    return visibleRows.reduce(
      (total, row) => ({
        items: total.items + 1,
        purchased: total.purchased + toNumber(row.purchasedBaseQuantity),
        consumed: total.consumed + toNumber(row.consumedBaseQuantity),
        balance: total.balance + toNumber(row.balanceBaseQuantity),
        shortage: total.shortage + (toNumber(row.balanceBaseQuantity) < 0 ? 1 : 0),
      }),
      { items: 0, purchased: 0, consumed: 0, balance: 0, shortage: 0 },
    );
  }, [visibleRows]);

  const columns = useMemo<SimpleTableColumn<OrderRecipeInventoryStockRow>[]>(() => [
    {
      key: 'productNameAr',
      label: 'المادة',
      minWidth: 220,
      align: 'center',
      render: (_value, row) => (
        <div className="text-center">
          <div className="font-extrabold text-noorix-text">{row.productNameAr}</div>
          {row.productNameEn ? <div className="mt-1 text-[12px] text-noorix-muted">{row.productNameEn}</div> : null}
        </div>
      ),
    },
    {
      key: 'sections',
      label: 'الأقسام',
      minWidth: 180,
      align: 'center',
      render: (_value, row) => (
        <div className="flex flex-wrap justify-center gap-1">
          {rowSectionLabels(row, sectionsById).map((label) => (
            <Badge key={label} color="green" size="sm">{label}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'unit',
      label: 'وحدة المخزون',
      width: 130,
      align: 'center',
      render: (value) => <span className="font-bold text-noorix-text">{String(value || '-')}</span>,
    },
    {
      key: 'purchasedBaseQuantity',
      label: 'الوارد',
      width: 130,
      numeric: true,
      align: 'center',
      render: (value) => <span className="font-extrabold text-emerald-700">{formatQuantity(value)}</span>,
    },
    {
      key: 'consumedBaseQuantity',
      label: 'المستهلك',
      width: 130,
      numeric: true,
      align: 'center',
      render: (value) => <span className="font-extrabold text-amber-700">{formatQuantity(value)}</span>,
    },
    {
      key: 'balanceBaseQuantity',
      label: 'المتبقي',
      width: 130,
      numeric: true,
      align: 'center',
      render: (value) => {
        const balance = toNumber(value);
        const color = balance < 0 ? 'text-red-700' : 'text-emerald-800';
        return <span className={`font-extrabold ${color}`}>{formatQuantity(value)}</span>;
      },
    },
    {
      key: 'productId',
      label: 'الحالة',
      width: 120,
      align: 'center',
      render: (_value, row) => {
        const status = stockStatus(row);
        return <Badge color={status.color} size="sm">{status.label}</Badge>;
      },
    },
  ], [sectionsById]);

  if (stockQuery.isLoading) {
    return <Spinner.Page label="جاري تحميل المخزون..." />;
  }

  if (stockQuery.error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center font-bold text-red-700">
        تعذر تحميل مخزون وتكلفة الأصناف.
      </div>
    );
  }

  return (
    <section className="space-y-4" dir="rtl">
      <div className="rounded-md border border-noorix-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 text-right">
          <Badge color="green" size="sm">مصدر موحد</Badge>
          <h2 className="text-[22px] font-extrabold text-noorix-text">مخزون وتكلفة عام</h2>
          <p className="text-[14px] leading-7 text-noorix-muted">
            رصيد كل مادة مشتراة من الطلبات، واستهلاكها من الرسبي عند بيع الأصناف. لا توجد حسابات في الواجهة؛
            الأرقام تأتي من الباكند.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <SummaryTile label="مواد" value={formatQuantity(summary.items)} />
        <SummaryTile label="الوارد" value={formatQuantity(summary.purchased)} tone="green" />
        <SummaryTile label="المستهلك" value={formatQuantity(summary.consumed)} tone="amber" />
        <SummaryTile label="المتبقي" value={formatQuantity(summary.balance)} tone={summary.balance < 0 ? 'red' : 'green'} />
        <SummaryTile label="عجز" value={formatQuantity(summary.shortage)} tone={summary.shortage > 0 ? 'red' : 'neutral'} />
      </div>

      <div className="rounded-md border border-noorix-border bg-white p-4 shadow-sm">
        <div className="mb-3 text-right text-[14px] font-extrabold text-noorix-text">فلترة حسب القسم</div>
        <div className="flex flex-wrap justify-end gap-2">
          {sectionOptions.map((option) => {
            const active = option.id === selectedSectionId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedSectionId(option.id)}
                className={[
                  'rounded-md border px-3 py-2 text-[13px] font-extrabold transition',
                  active
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-800 shadow-sm'
                    : 'border-noorix-border bg-white text-noorix-text hover:border-emerald-300',
                ].join(' ')}
              >
                {option.label}
                <span className="ms-2 rounded-full bg-noorix-bg-muted px-2 py-0.5 text-[11px] text-noorix-muted">
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SimpleTable
        columns={columns}
        data={visibleRows}
        tableMinWidth={1040}
        stickyHeader
        emptyMessage="لا توجد مواد مخزون مطابقة للفلتر."
        frameClassName="shadow-sm"
      />
    </section>
  );
}

export default ShishaInventoryTab;
