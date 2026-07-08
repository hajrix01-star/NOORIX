import React, { useState } from 'react';
import { Badge, DateField, DateRangeField, Input } from '../../ui';
import { useTranslation } from '../../i18n/useTranslation';

type PillTone = 'blue' | 'green' | 'amber' | 'violet' | 'gray';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function OdooButton({
  children,
  active,
  primary,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center justify-center gap-1 rounded-md border px-3 text-[12px] font-bold transition-colors',
        primary && 'border-[#714b67] bg-[#714b67] text-white shadow-sm',
        active && !primary && 'border-[#714b67]/30 bg-[#714b67]/10 text-[#714b67]',
        !active && !primary && 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

function OdooPill({
  children,
  tone = 'gray',
  removable = true,
  onClick,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  removable?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    violet: 'border-[#714b67]/20 bg-[#714b67]/10 text-[#714b67]',
    gray: 'border-slate-200 bg-slate-100 text-slate-700',
  }[tone];

  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] font-bold', toneClass)}
    >
      {children}
      {removable && <span className="text-[13px] opacity-70">×</span>}
    </Tag>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 border-b border-slate-200 pb-2 text-[12px] font-black uppercase text-slate-500">{title}</div>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

function MenuItem({
  label,
  hint,
  checked,
  nested,
  muted,
  onClick,
}: {
  label: string;
  hint?: string;
  checked?: boolean;
  nested?: boolean;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-start text-[12px]',
        checked ? 'bg-[#714b67]/10 text-[#714b67]' : 'text-slate-700 hover:bg-slate-50',
        muted && 'opacity-60',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-slate-300 bg-white text-[10px] text-[#714b67]">
          {checked ? '✓' : ''}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold">{label}</span>
          {hint && <span className="block truncate text-[10px] text-slate-500">{hint}</span>}
        </span>
      </span>
      {nested && <span className="text-slate-400">›</span>}
    </button>
  );
}

function RuleRow({ field, operator, value }: { field: string; operator: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[1fr_120px_1fr_auto]">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] font-bold text-slate-700">{field}</div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] font-bold text-slate-700">{operator}</div>
      <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] font-bold text-slate-900">{value}</div>
      <button type="button" className="rounded-md border border-slate-200 bg-white px-2 text-[12px] font-bold text-slate-500">×</button>
    </div>
  );
}

function GroupPreviewRow({ title, count, total, children }: { title: string; count: number; total: string; children?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">▾</span>
          <strong className="text-[13px] text-slate-900">{title}</strong>
          <Badge color="gray" size="sm">{count}</Badge>
        </div>
        <strong className="text-[13px] text-[#714b67]">{total}</strong>
      </div>
      {children && <div className="divide-y divide-slate-100">{children}</div>}
    </div>
  );
}

function ResultLine({ doc, partner, amount }: { doc: string; partner: string; amount: string }) {
  return (
    <div className="grid gap-2 px-3 py-2 text-[12px] md:grid-cols-[140px_minmax(0,1fr)_120px]">
      <span className="font-black text-[#714b67]">{doc}</span>
      <span className="truncate text-slate-600">{partner}</span>
      <span className="text-end font-black text-slate-900">{amount}</span>
    </div>
  );
}

export default function ThemeFiltersV2Tab() {
  const { lang } = useTranslation();
  const isArabic = lang === 'ar';
  const [activeMenu, setActiveMenu] = useState<'filters' | 'group' | 'favorites'>('filters');
  const [showDatePanel, setShowDatePanel] = useState(true);
  const [orderDate, setOrderDate] = useState('2026-07-08');
  const [rangeStart, setRangeStart] = useState('2026-07-01');
  const [rangeEnd, setRangeEnd] = useState('2026-07-08');
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [comparison, setComparison] = useState<'period' | 'year'>('period');
  const [favoriteName, setFavoriteName] = useState(isArabic ? 'إدارة مشتريات الشهر' : 'Monthly purchase control');

  const text = {
    hero: isArabic ? 'فلاتر 2 - نموذج Odoo Search View' : 'Filters 2 - Odoo Search View pattern',
    desc: isArabic
      ? 'هذا النموذج يقتبس طريقة Odoo: شريط بحث واحد أعلى الشاشة، ومنه Filters وGroup By وFavorites، مع فلاتر جاهزة ومخصصة ومقارنة زمنية وحفظ البحث.'
      : 'This model adopts the Odoo pattern: one search bar at the top, opening Filters, Group By, and Favorites, with preconfigured filters, custom filters, comparisons, and saved searches.',
    searchPlaceholder: isArabic ? 'ابحث في المورد، رقم الفاتورة، المستخدم...' : 'Search supplier, invoice number, user...',
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f6eff5_100%)] shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="p-5">
          <div className="inline-flex h-8 items-center rounded-full border border-[#714b67]/20 bg-white px-3 text-[12px] font-black text-[#714b67] shadow-sm">
            Odoo-inspired
          </div>
          <h3 className="m-0 mt-4 text-[25px] font-black leading-tight text-slate-950">{text.hero}</h3>
          <p className="m-0 mt-2 max-w-[880px] text-[13px] leading-6 text-slate-600">{text.desc}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-[16px] text-slate-400" aria-hidden>⌕</span>
              <OdooPill tone="violet" onClick={() => setShowDatePanel((value) => !value)}>
                {isArabic ? `تاريخ الطلب: ${orderDate}` : `Order Date: ${orderDate}`}
              </OdooPill>
              <OdooPill tone="green">{isArabic ? 'الحالة: مرحل' : 'Status: Posted'}</OdooPill>
              <OdooPill tone="amber">{isArabic ? 'المبلغ > 1,000' : 'Amount > 1,000'}</OdooPill>
              <span className="min-w-[180px] flex-1 text-[13px] text-slate-400">{text.searchPlaceholder}</span>
              <button type="button" onClick={() => setActiveMenu('filters')} className="rounded-md px-2 text-[16px] font-black text-[#714b67]">▾</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <OdooButton active={activeMenu === 'filters'} onClick={() => setActiveMenu('filters')}>{isArabic ? 'الفلاتر' : 'Filters'}</OdooButton>
              <OdooButton active={activeMenu === 'group'} onClick={() => setActiveMenu('group')}>{isArabic ? 'تجميع حسب' : 'Group By'}</OdooButton>
              <OdooButton active={activeMenu === 'favorites'} onClick={() => setActiveMenu('favorites')}>{isArabic ? 'المفضلة' : 'Favorites'}</OdooButton>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[16px] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-4 p-4 lg:grid-cols-3">
              <MenuSection title={isArabic ? 'Filters' : 'Filters'}>
                <MenuItem label={isArabic ? 'فواتير هذا الشهر' : 'This month bills'} checked={activeMenu === 'filters'} onClick={() => setActiveMenu('filters')} />
                <MenuItem label={isArabic ? 'بحاجة مراجعة' : 'Needs review'} />
                <MenuItem label={isArabic ? 'غير مدفوعة' : 'Unpaid'} />
                <MenuItem label={isArabic ? 'تاريخ الطلب' : 'Order Date'} nested checked={showDatePanel} onClick={() => setShowDatePanel((value) => !value)} />
                <div className="my-1 h-px bg-slate-200" />
                <MenuItem label={isArabic ? 'إضافة فلتر مخصص' : 'Add Custom Filter'} />
              </MenuSection>

              <MenuSection title={isArabic ? 'Group By' : 'Group By'}>
                <MenuItem label={isArabic ? 'المورد' : 'Supplier'} checked={activeMenu === 'group'} onClick={() => setActiveMenu('group')} />
                <MenuItem label={isArabic ? 'الحالة' : 'Status'} />
                <MenuItem label={isArabic ? 'المستخدم' : 'User'} />
                <MenuItem label={isArabic ? 'الشهر' : 'Month'} checked />
                <div className="my-1 h-px bg-slate-200" />
                <MenuItem label={isArabic ? 'إضافة تجميع مخصص' : 'Add Custom Group'} />
              </MenuSection>

              <MenuSection title={isArabic ? 'Favorites' : 'Favorites'}>
                <MenuItem label={isArabic ? 'إدارة اليوم' : 'Daily control'} checked={activeMenu === 'favorites'} onClick={() => setActiveMenu('favorites')} />
                <MenuItem label={isArabic ? 'مراجعة الضريبة' : 'Tax review'} />
                <MenuItem label={isArabic ? 'مشتريات الغذاء' : 'Food purchases'} />
                <div className="my-1 h-px bg-slate-200" />
                <MenuItem label={isArabic ? 'حفظ البحث الحالي' : 'Save current search'} />
                <MenuItem label={isArabic ? 'تعيينه كافتراضي' : 'Set as default'} />
              </MenuSection>
            </div>
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="block text-[14px] text-slate-950">
                  {activeMenu === 'filters'
                    ? isArabic ? 'فلتر مخصص وتاريخ' : 'Custom filter and date'
                    : activeMenu === 'group'
                      ? isArabic ? 'إعداد التجميع' : 'Group setup'
                      : isArabic ? 'حفظ البحث' : 'Save search'}
                </strong>
                <span className="text-[12px] text-slate-500">
                  {activeMenu === 'filters'
                    ? isArabic ? 'اضغط على التاريخ لفتح التقويم، أو اختر نطاقًا.' : 'Click date to open the calendar, or choose a range.'
                    : activeMenu === 'group'
                      ? isArabic ? 'Odoo يسمح بعدة مستويات تجميع في نفس الوقت.' : 'Odoo allows several group levels at once.'
                      : isArabic ? 'احفظ البحث كافتراضي أو شاركه.' : 'Save the search as default or shared.'}
                </span>
              </div>
              {activeMenu === 'filters' && (
                <div className="flex gap-2">
                  <OdooButton active={matchMode === 'all'} onClick={() => setMatchMode('all')}>{isArabic ? 'كل القواعد' : 'Match all'}</OdooButton>
                  <OdooButton active={matchMode === 'any'} onClick={() => setMatchMode('any')}>{isArabic ? 'أي قاعدة' : 'Match any'}</OdooButton>
                </div>
              )}
            </div>
            {activeMenu === 'filters' && (
              <>
                {showDatePanel && (
                  <div className="mb-3 rounded-xl border border-[#714b67]/20 bg-white p-3">
                    <div className="mb-2 text-[12px] font-black text-[#714b67]">{isArabic ? 'تاريخ الطلب' : 'Order Date'}</div>
                    <div className="grid gap-3">
                      <DateField
                        label={isArabic ? 'يوم محدد' : 'Single day'}
                        value={orderDate}
                        onValueChange={setOrderDate}
                        lang={lang}
                      />
                      <DateRangeField
                        startLabel={isArabic ? 'من' : 'From'}
                        endLabel={isArabic ? 'إلى' : 'To'}
                        startValue={rangeStart}
                        endValue={rangeEnd}
                        minEnd={rangeStart}
                        onStartChange={setRangeStart}
                        onEndChange={setRangeEnd}
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-2">
                  <RuleRow field={isArabic ? 'الحالة' : 'Status'} operator={isArabic ? 'يساوي' : 'is'} value={isArabic ? 'مرحل' : 'Posted'} />
                  <RuleRow field={isArabic ? 'الإجمالي' : 'Total'} operator=">" value="1,000 SR" />
                  <RuleRow field={isArabic ? 'تاريخ الطلب' : 'Order Date'} operator={isArabic ? 'بين' : 'between'} value={`${rangeStart} → ${rangeEnd}`} />
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2">
                  <OdooButton>{isArabic ? '+ قاعدة' : '+ Rule'}</OdooButton>
                  <OdooButton primary>{isArabic ? 'إضافة' : 'Add'}</OdooButton>
                </div>
              </>
            )}
            {activeMenu === 'group' && (
              <div className="grid gap-2">
                <MenuItem label={isArabic ? '1. المورد' : '1. Supplier'} checked />
                <MenuItem label={isArabic ? '2. الشهر' : '2. Month'} checked />
                <MenuItem label={isArabic ? '3. الحالة' : '3. Status'} />
                <div className="mt-2 flex justify-end">
                  <OdooButton primary>{isArabic ? 'تطبيق التجميع' : 'Apply grouping'}</OdooButton>
                </div>
              </div>
            )}
            {activeMenu === 'favorites' && (
              <div className="grid gap-3">
                <Input
                  label={isArabic ? 'اسم الفلتر' : 'Filter name'}
                  value={favoriteName}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFavoriteName(event.currentTarget.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <OdooPill tone="green" removable={false}>{isArabic ? 'افتراضي' : 'Default'}</OdooPill>
                  <OdooPill tone="blue" removable={false}>{isArabic ? 'مشترك' : 'Shared'}</OdooPill>
                </div>
                <div className="flex justify-end">
                  <OdooButton primary>{isArabic ? 'حفظ البحث' : 'Save search'}</OdooButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="block text-[15px] text-slate-950">{isArabic ? 'نتائج مجمعة مثل Odoo' : 'Odoo-like grouped results'}</strong>
              <span className="text-[12px] text-slate-500">{isArabic ? 'الفلاتر والتجميع يعملان معًا بدون إخفاء السياق.' : 'Filters and groups work together without hiding context.'}</span>
            </div>
            <div className="flex gap-2">
              <OdooPill tone="violet" removable={false}>{isArabic ? 'تجميع: المورد / الشهر' : 'Group: Supplier / Month'}</OdooPill>
            </div>
          </div>
          <div className="grid gap-3">
            <GroupPreviewRow title={isArabic ? 'السعادة' : 'Al-Saada'} count={3} total="3,450 SR">
              <ResultLine doc="PUR-20260708-001" partner={isArabic ? 'فاتورة غذاء' : 'Food invoice'} amount="2,300 SR" />
              <ResultLine doc="EXP-20260708-004" partner={isArabic ? 'مصروف خدمة' : 'Service expense'} amount="575 SR" />
              <ResultLine doc="PUR-20260707-003" partner={isArabic ? 'فاتورة مشتريات' : 'Purchase bill'} amount="575 SR" />
            </GroupPreviewRow>
            <GroupPreviewRow title={isArabic ? 'مورد الخدمات' : 'Services Supplier'} count={2} total="920 SR">
              <ResultLine doc="EXP-20260708-002" partner={isArabic ? 'اشتراك شهري' : 'Monthly subscription'} amount="345 SR" />
              <ResultLine doc="EXP-20260706-001" partner={isArabic ? 'صيانة' : 'Maintenance'} amount="575 SR" />
            </GroupPreviewRow>
          </div>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]">
          <strong className="block text-[15px] text-slate-950">{isArabic ? 'المقارنة والمفضلة' : 'Comparison and favorites'}</strong>
          <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
            {isArabic ? 'في التقارير، تظهر مقارنة الفترة السابقة/السنة السابقة عند وجود فلتر زمني.' : 'In reports, previous period/year comparison appears when a time filter exists.'}
          </p>
          <div className="mt-3 grid gap-2">
            <MenuItem
              label={isArabic ? 'مقارنة: الفترة السابقة' : 'Comparison: Previous Period'}
              checked={comparison === 'period'}
              onClick={() => setComparison('period')}
            />
            <MenuItem
              label={isArabic ? 'مقارنة: السنة السابقة' : 'Comparison: Previous Year'}
              checked={comparison === 'year'}
              onClick={() => setComparison('year')}
            />
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-bold text-slate-600">
            {comparison === 'period'
              ? isArabic ? 'سيتم عرض الفترة الحالية مقابل الفترة السابقة.' : 'Current period will be compared with the previous period.'
              : isArabic ? 'سيتم عرض الفترة الحالية مقابل نفس الفترة من السنة السابقة.' : 'Current period will be compared with the same period from the previous year.'}
          </div>
          <div className="mt-4 rounded-xl border border-[#714b67]/20 bg-[#714b67]/5 p-3">
            <div className="text-[12px] font-black text-[#714b67]">{isArabic ? 'حفظ البحث الحالي' : 'Save current search'}</div>
            <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-500">
              {isArabic ? 'اسم الفلتر: إدارة مشتريات الشهر' : 'Filter name: Monthly purchase control'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <OdooPill tone="green" removable={false}>{isArabic ? 'افتراضي' : 'Default'}</OdooPill>
              <OdooPill tone="blue" removable={false}>{isArabic ? 'مشترك' : 'Shared'}</OdooPill>
            </div>
            <div className="mt-3">
              <OdooButton primary>{isArabic ? 'حفظ' : 'Save'}</OdooButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
