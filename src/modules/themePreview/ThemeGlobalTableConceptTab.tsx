import React, { useMemo, useState } from 'react';
import { Button, Checkbox, Input, KebabMenu, SmartTable, SummaryBar } from '../../ui';
import type { SmartTableColumn } from '../../ui';
import { useTranslation } from '../../i18n/useTranslation';
import {
  CommandMetric,
  FilterChip,
  GLOBAL_TABLE_ROWS,
  PrincipleCard,
  RiskBadge,
  StatusBadge,
  amount,
  type GlobalTableConceptRow,
} from './ThemeGlobalTableConceptParts';

export default function ThemeGlobalTableConceptTab() {
  const { lang } = useTranslation();
  const isArabic = lang === 'ar';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(['2']));
  const selectedCount = selectedIds.size;

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const columns = useMemo<SmartTableColumn<GlobalTableConceptRow>[]>(() => [
    {
      key: 'select',
      label: '',
      width: '48px',
      shrink: true,
      render: (_value, row) => (
        <Checkbox
          checked={selectedIds.has(row.id)}
          onChange={(event) => toggleRow(row.id, event.currentTarget.checked)}
          aria-label={`${isArabic ? 'تحديد' : 'Select'} ${row.document}`}
        />
      ),
    },
    {
      key: 'document',
      kind: 'id',
      label: isArabic ? 'المستند' : 'Document',
      sortable: true,
      width: '16ch',
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-black text-noorix-blue">{row.document}</div>
          <div className="mt-0.5 text-[11px] font-bold text-noorix-muted">{row.date}</div>
        </div>
      ),
    },
    {
      key: 'account',
      kind: 'text',
      label: isArabic ? 'المسار المحاسبي' : 'Accounting path',
      sortable: true,
      minWidth: 240,
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-extrabold text-noorix-text">{row.account}</div>
          <div className="mt-0.5 text-[11px] text-noorix-muted">{row.owner}</div>
        </div>
      ),
    },
    {
      key: 'channel',
      kind: 'meta',
      label: isArabic ? 'القناة' : 'Channel',
      width: '12ch',
      render: (_value, row) => <span className="nx-pill nx-pill--blue nx-pill--sm">{row.channel}</span>,
    },
    {
      key: 'status',
      kind: 'status',
      label: isArabic ? 'الحالة' : 'Status',
      width: '12ch',
      render: (_value, row) => <StatusBadge status={row.status} isArabic={isArabic} />,
    },
    {
      key: 'risk',
      kind: 'status',
      label: isArabic ? 'المخاطر' : 'Risk',
      width: '12ch',
      render: (_value, row) => <RiskBadge risk={row.risk} isArabic={isArabic} />,
    },
    {
      key: 'net',
      kind: 'money',
      label: isArabic ? 'الصافي' : 'Net',
      numeric: true,
      width: '12ch',
      render: (_value, row) => amount(row.net),
    },
    {
      key: 'tax',
      kind: 'money',
      label: isArabic ? 'الضريبة' : 'Tax',
      numeric: true,
      width: '12ch',
      render: (_value, row) => amount(row.tax),
    },
    {
      key: 'total',
      kind: 'money',
      label: isArabic ? 'الإجمالي' : 'Total',
      numeric: true,
      width: '13ch',
      render: (_value, row) => amount(row.total),
    },
    {
      key: 'actions',
      kind: 'actions',
      label: '',
      width: '56px',
      shrink: true,
      render: (_value, row) => (
        <KebabMenu
          ariaLabel={`${isArabic ? 'إجراءات' : 'Actions'} ${row.document}`}
          items={[
            { key: 'open', label: isArabic ? 'فتح' : 'Open', onClick: () => {} },
            { key: 'audit', label: isArabic ? 'تدقيق' : 'Audit', onClick: () => {} },
          ]}
        />
      ),
    },
  ], [isArabic, selectedIds]);

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-[18px] border border-noorix-border bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_46%,#eefbf6_100%)] shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0">
            <div className="inline-flex h-8 items-center rounded-full border border-noorix-blue/20 bg-white/80 px-3 text-[12px] font-extrabold text-noorix-blue shadow-sm">
              {isArabic ? 'Global Table Theme / اقتباس كبير' : 'Global Table Theme / strong adoption'}
            </div>
            <h3 className="m-0 mt-4 text-[24px] font-black leading-tight text-noorix-text">
              {isArabic ? 'ثيم جداول عالمي مختلف بصريًا وقابل للتحويل إلى معيار للنظام' : 'A visually distinct global table theme ready to become a system standard'}
            </h3>
            <p className="m-0 mt-2 max-w-[760px] text-[13px] leading-6 text-noorix-muted">
              {isArabic
                ? 'هذا ليس تغيير ألوان فقط. النموذج يعيد ترتيب تجربة الجدول: رأس واضح، أوامر عامة، فلاتر نشطة، تحديد صفوف، ملخصات، وحاوية واحدة تحترم البيانات الكبيرة.'
                : 'This is not a color-only change. It reshapes the table experience with a strong header, global commands, active filters, row selection, summaries, and a shell built for large data.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <FilterChip label={isArabic ? 'كل العمليات' : 'All operations'} active />
              <FilterChip label={isArabic ? 'تحتاج مراجعة' : 'Needs review'} />
              <FilterChip label={isArabic ? 'شامل الضريبة' : 'Tax included'} />
              <FilterChip label={isArabic ? 'كامل الفترة' : 'Full period'} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <CommandMetric label={isArabic ? 'الإجمالي' : 'Total'} value="9,200 SR" tone="blue" />
            <CommandMetric label={isArabic ? 'الصافي' : 'Net'} value="8,000 SR" tone="green" />
            <CommandMetric label={isArabic ? 'الضريبة' : 'Tax'} value="1,200 SR" tone="amber" />
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-4">
        <PrincipleCard
          accent="blue"
          title={isArabic ? 'Toolbar قائد' : 'Command toolbar'}
          body={isArabic ? 'البحث والفلاتر والأعمدة والإجراءات العامة تظهر كمنطقة قيادة واضحة.' : 'Search, filters, columns, and actions are presented as one command area.'}
        />
        <PrincipleCard
          accent="green"
          title={isArabic ? 'أرقام للعرض فقط' : 'Display-only numbers'}
          body={isArabic ? 'الأرقام رسمية من المصدر، والواجهة لا تعيد حسابها.' : 'Official numbers come from the source; the UI does not recalculate them.'}
        />
        <PrincipleCard
          accent="amber"
          title={isArabic ? 'اختيار وعمليات جماعية' : 'Selection and batch actions'}
          body={isArabic ? 'عند تحديد صفوف تظهر الأوامر الجماعية فورًا دون تشويش الجدول.' : 'Batch commands appear immediately when rows are selected.'}
        />
        <PrincipleCard
          accent="violet"
          title={isArabic ? 'قابل للتوسع' : 'Scales cleanly'}
          body={isArabic ? 'مصمم ليستوعب أعمدة كثيرة وبيانات طويلة بدون تكديس بصري.' : 'Designed for many columns and long periods without visual clutter.'}
        />
      </div>

      <section className="overflow-hidden rounded-[18px] border border-noorix-border bg-white shadow-[0_20px_55px_rgba(15,23,42,0.10)]">
        <div className="border-b border-noorix-border bg-[linear-gradient(90deg,#0f3666_0%,#125f7c_48%,#13805f_100%)] px-5 py-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-[17px] font-black text-white">
                  {isArabic ? 'جدول العمليات العالمي' : 'Global operations table'}
                </h3>
                <span className="rounded-full bg-white/16 px-2.5 py-1 text-[11px] font-extrabold text-white">
                  {isArabic ? 'تصميم مستهدف' : 'Target design'}
                </span>
              </div>
              <p className="m-0 mt-1 text-[12px] leading-5 text-white/78">
                {isArabic
                  ? 'نسخة مرجعية لاختبار شكل الجداول القادم: أوضح، أهدأ، وأقوى في الاستخدام اليومي.'
                  : 'Reference version for the next table look: clearer, calmer, and stronger for daily work.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">{isArabic ? 'تصدير' : 'Export'}</Button>
              <Button size="sm">{isArabic ? 'حفظ العرض' : 'Save view'}</Button>
              <Button size="sm" variant="primary">{isArabic ? 'عملية جديدة' : 'New entry'}</Button>
            </div>
          </div>
        </div>

        <div className="border-b border-noorix-border bg-noorix-bg-muted/55 p-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
            <Input
              size="sm"
              placeholder={isArabic ? 'بحث في المستند أو المسار المحاسبي أو المسؤول...' : 'Search document, accounting path, or owner...'}
              readOnly
              className="bg-white"
            />
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip label={isArabic ? 'الكثافة: مريحة' : 'Density: comfy'} active />
              <FilterChip label={isArabic ? 'الأعمدة: 9/10' : 'Columns: 9/10'} />
              <FilterChip label={isArabic ? 'الفرز: الأحدث' : 'Sort: newest'} />
              <FilterChip label={isArabic ? 'المخاطر: الكل' : 'Risk: all'} />
            </div>
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-blue/20 bg-noorix-blue/10 px-5 py-3 text-[13px]">
            <strong className="text-noorix-blue">
              {isArabic ? `${selectedCount} صف محدد` : `${selectedCount} row selected`}
            </strong>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">{isArabic ? 'مراجعة' : 'Review'}</Button>
              <Button size="sm">{isArabic ? 'تصدير المحدد' : 'Export selected'}</Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>{isArabic ? 'إلغاء التحديد' : 'Clear'}</Button>
            </div>
          </div>
        ) : null}

        <SummaryBar
          className="m-3"
          items={[
            { key: 'net', label: isArabic ? 'الصافي' : 'Net', value: 8000, tone: 'green', currency: 'SR' },
            { key: 'tax', label: isArabic ? 'الضريبة' : 'Tax', value: 1200, tone: 'amber', currency: 'SR' },
            { key: 'total', label: isArabic ? 'الإجمالي' : 'Total', value: 9200, tone: 'blue', currency: 'SR' },
            { key: 'rows', label: isArabic ? 'السجلات' : 'Rows', value: GLOBAL_TABLE_ROWS.length, tone: 'purple' },
          ]}
        />

        <div className="px-3 pb-3">
          <div className="overflow-hidden rounded-xl border border-noorix-border bg-white shadow-sm">
            <SmartTable
              columns={columns}
              data={GLOBAL_TABLE_ROWS}
              total={GLOBAL_TABLE_ROWS.length}
              page={1}
              pageSize={10}
              tableMinWidth={1280}
              showRowNumbers
              compact
              showSearchInHeader={false}
              frameClassName="border-0 shadow-none rounded-none"
              footerRow={[
                { keys: ['select', 'document', 'account', 'channel', 'status', 'risk'], content: isArabic ? 'إجمالي كامل الفترة' : 'Full-period total', className: 'nx-tfoot-label' },
                { keys: ['net'], content: amount(8000), className: 'nx-tfoot-num' },
                { keys: ['tax'], content: amount(1200), className: 'nx-tfoot-num' },
                { keys: ['total'], content: amount(9200), className: 'nx-tfoot-num' },
                { keys: ['actions'], content: '' },
              ]}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
