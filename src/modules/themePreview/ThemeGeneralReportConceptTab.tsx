import React from 'react';
import { Badge, Button, SimpleTable } from '../../ui';
import type { SimpleTableColumn } from '../../ui';
import { useTranslation } from '../../i18n/useTranslation';

type Tone = 'mint' | 'ink' | 'sky' | 'gold' | 'rose';

type Metric = {
  key: string;
  labelAr: string;
  labelEn: string;
  value: string;
  helperAr: string;
  helperEn: string;
  tone: Tone;
};

type Flow = {
  key: string;
  labelAr: string;
  labelEn: string;
  value: number;
  captionAr: string;
  captionEn: string;
  tone: Tone;
};

type Signal = {
  key: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  value: string;
  tone: Tone;
};

type TimelineRow = {
  id: string;
  laneAr: string;
  laneEn: string;
  titleAr: string;
  titleEn: string;
  ownerAr: string;
  ownerEn: string;
  amount: number;
  statusAr: string;
  statusEn: string;
};

const metrics: Metric[] = [
  {
    key: 'cash',
    labelAr: 'السيولة المتاحة',
    labelEn: 'Available liquidity',
    value: '184,600 SR',
    helperAr: 'تكفي 41 يوم تشغيل',
    helperEn: 'Covers 41 operating days',
    tone: 'mint',
  },
  {
    key: 'margin',
    labelAr: 'هامش التشغيل',
    labelEn: 'Operating margin',
    value: '24.8%',
    helperAr: '+3.4 عن الشهر السابق',
    helperEn: '+3.4 vs previous month',
    tone: 'ink',
  },
  {
    key: 'receivable',
    labelAr: 'تحصيل قريب',
    labelEn: 'Near-term collection',
    value: '72,900 SR',
    helperAr: 'خلال 7 أيام',
    helperEn: 'Due within 7 days',
    tone: 'sky',
  },
  {
    key: 'risk',
    labelAr: 'ضغط الالتزامات',
    labelEn: 'Obligation pressure',
    value: 'متوسط',
    helperAr: 'موردان يحتاجان جدولة',
    helperEn: '2 suppliers need scheduling',
    tone: 'gold',
  },
];

const flows: Flow[] = [
  { key: 'sales', labelAr: 'مبيعات', labelEn: 'Sales', value: 82, captionAr: 'نشاط قوي', captionEn: 'Strong activity', tone: 'mint' },
  { key: 'collection', labelAr: 'تحصيل', labelEn: 'Collection', value: 67, captionAr: 'أقل من الهدف', captionEn: 'Below target', tone: 'sky' },
  { key: 'cost', labelAr: 'تكلفة', labelEn: 'Cost', value: 54, captionAr: 'مستقرة', captionEn: 'Stable', tone: 'gold' },
  { key: 'expenses', labelAr: 'مصروفات', labelEn: 'Expenses', value: 38, captionAr: 'تحت السيطرة', captionEn: 'Controlled', tone: 'rose' },
];

const signals: Signal[] = [
  {
    key: 'vat',
    titleAr: 'الضريبة تبدو قابلة للتسوية',
    titleEn: 'VAT appears reconcilable',
    bodyAr: 'الفروقات التجريبية موزعة على قنوات دفع واضحة ولا توجد قفزة شاذة في العينة.',
    bodyEn: 'Mock variances are spread across clear payment channels with no unusual jump in the sample.',
    value: '92%',
    tone: 'mint',
  },
  {
    key: 'stock',
    titleAr: 'مخزون سريع الدوران',
    titleEn: 'Fast-moving stock',
    bodyAr: 'أربع فئات تحقق أغلب التدفق، مع مساحة لعرض تنبيه نقص قبل أن يصبح مشكلة.',
    bodyEn: 'Four categories drive most movement, with room for an early low-stock warning.',
    value: '4 فئات',
    tone: 'sky',
  },
  {
    key: 'payables',
    titleAr: 'نافذة دفع ضيقة',
    titleEn: 'Tight payment window',
    bodyAr: 'الالتزامات التجريبية مركزة في منتصف الفترة، لذلك يظهر اقتراح جدولة هادئ.',
    bodyEn: 'Mock obligations cluster mid-period, so the concept surfaces a calm scheduling cue.',
    value: '11 يوم',
    tone: 'gold',
  },
];

const timelineRows: TimelineRow[] = [
  {
    id: 'A-102',
    laneAr: 'تحصيل',
    laneEn: 'Collection',
    titleAr: 'دفعة عميل رئيسي',
    titleEn: 'Key customer payment',
    ownerAr: 'المبيعات',
    ownerEn: 'Sales',
    amount: 28900,
    statusAr: 'منتظر',
    statusEn: 'Pending',
  },
  {
    id: 'P-044',
    laneAr: 'التزامات',
    laneEn: 'Payables',
    titleAr: 'جدولة مورد مواد',
    titleEn: 'Supplier scheduling',
    ownerAr: 'المشتريات',
    ownerEn: 'Purchasing',
    amount: 17450,
    statusAr: 'مراجعة',
    statusEn: 'Review',
  },
  {
    id: 'C-018',
    laneAr: 'نقد',
    laneEn: 'Cash',
    titleAr: 'تغذية خزنة فرع',
    titleEn: 'Branch vault top-up',
    ownerAr: 'المالية',
    ownerEn: 'Finance',
    amount: 12000,
    statusAr: 'جاهز',
    statusEn: 'Ready',
  },
];

function money(value: number) {
  return (
    <span dir="ltr" className="nx-cell-num font-black text-noorix-text">
      {value.toLocaleString('en')} <span className="nx-sar">SR</span>
    </span>
  );
}

function toneClass(tone: Tone) {
  return {
    mint: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    ink: 'border-slate-300 bg-slate-900 text-white',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    gold: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  }[tone];
}

function barClass(tone: Tone) {
  return {
    mint: 'bg-emerald-500',
    ink: 'bg-slate-800',
    sky: 'bg-sky-500',
    gold: 'bg-amber-500',
    rose: 'bg-rose-500',
  }[tone];
}

function MetricTile({ item, isArabic }: { item: Metric; isArabic: boolean }) {
  return (
    <div className={`min-h-[132px] rounded-lg border px-4 py-3 ${toneClass(item.tone)}`}>
      <div className="text-[12px] font-extrabold opacity-80">{isArabic ? item.labelAr : item.labelEn}</div>
      <div className="mt-3 text-[25px] font-black leading-none tracking-normal">{item.value}</div>
      <div className="mt-3 text-[12px] font-bold opacity-75">{isArabic ? item.helperAr : item.helperEn}</div>
    </div>
  );
}

function FlowStrip({ item, isArabic }: { item: Flow; isArabic: boolean }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-black text-noorix-text">{isArabic ? item.labelAr : item.labelEn}</span>
        <span className="text-[12px] font-extrabold text-noorix-muted">{item.value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-noorix-bg-muted">
        <div className={`h-full rounded-full ${barClass(item.tone)}`} style={{ width: `${item.value}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-noorix-muted">{isArabic ? item.captionAr : item.captionEn}</span>
    </div>
  );
}

function SignalPanel({ item, isArabic }: { item: Signal; isArabic: boolean }) {
  return (
    <article className="rounded-lg border border-noorix-border bg-white px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h4 className="m-0 text-[13px] font-black leading-5 text-noorix-text">{isArabic ? item.titleAr : item.titleEn}</h4>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-black ${toneClass(item.tone)}`}>{item.value}</span>
      </div>
      <p className="m-0 mt-2 text-[12px] leading-5 text-noorix-muted">{isArabic ? item.bodyAr : item.bodyEn}</p>
    </article>
  );
}

export default function ThemeGeneralReportConceptTab() {
  const { lang } = useTranslation();
  const isArabic = lang === 'ar';

  const columns: SimpleTableColumn<TimelineRow>[] = [
    {
      key: 'id',
      label: isArabic ? 'المعرف' : 'ID',
      width: '92px',
      render: (_value, row) => <span className="font-black text-noorix-blue">{row.id}</span>,
    },
    {
      key: 'lane',
      label: isArabic ? 'المسار' : 'Lane',
      width: '120px',
      render: (_value, row) => <Badge color="blue" size="sm">{isArabic ? row.laneAr : row.laneEn}</Badge>,
    },
    {
      key: 'title',
      label: isArabic ? 'الإشارة' : 'Signal',
      minWidth: 210,
      render: (_value, row) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-black text-noorix-text">{isArabic ? row.titleAr : row.titleEn}</div>
          <div className="mt-0.5 text-[11px] font-bold text-noorix-muted">{isArabic ? row.ownerAr : row.ownerEn}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: isArabic ? 'القيمة' : 'Amount',
      numeric: true,
      width: '130px',
      render: (_value, row) => money(row.amount),
    },
    {
      key: 'status',
      label: isArabic ? 'الحالة' : 'Status',
      width: '110px',
      render: (_value, row) => <Badge color={row.statusEn === 'Ready' ? 'green' : row.statusEn === 'Review' ? 'amber' : 'gray'} size="sm">{isArabic ? row.statusAr : row.statusEn}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#101828_0%,#17424a_52%,#f7c948_160%)] text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-black text-white">
                {isArabic ? 'تجربة معاينة فقط' : 'Preview experiment only'}
              </span>
              <span className="rounded-md border border-emerald-200/30 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-black text-emerald-100">
                {isArabic ? 'بيانات وهمية' : 'Mock data'}
              </span>
            </div>
            <h3 className="m-0 mt-4 max-w-[780px] text-[28px] font-black leading-tight text-white">
              {isArabic ? 'مركز قيادة مالي للتقرير العام' : 'Financial command center for the general report'}
            </h3>
            <p className="m-0 mt-3 max-w-[760px] text-[13px] leading-6 text-white/76">
              {isArabic
                ? 'تصور بديل لا يعرض التقرير كجدول تقليدي، بل يقرأ الحالة المالية بسرعة: سيولة، ربحية، تحصيل، التزامات، وإشارات تستحق الانتباه.'
                : 'An alternate concept that avoids the classic report table and reads the financial state quickly: liquidity, margin, collection, obligations, and signals worth attention.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" className="!border-white/25 !bg-white/12 !text-white hover:!bg-white/18">{isArabic ? 'عرض تنفيذي' : 'Executive view'}</Button>
              <Button size="sm" className="!border-white/25 !bg-white/12 !text-white hover:!bg-white/18">{isArabic ? 'تحليل نقدي' : 'Cash analysis'}</Button>
              <Button size="sm" className="!border-white/25 !bg-white/12 !text-white hover:!bg-white/18">{isArabic ? 'مراجعة الالتزامات' : 'Payables review'}</Button>
            </div>
          </div>
          <div className="rounded-lg border border-white/16 bg-white/10 p-4 backdrop-blur">
            <div className="text-[12px] font-bold text-white/70">{isArabic ? 'مؤشر صحة تجريبي' : 'Mock health score'}</div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-[46px] font-black leading-none text-white">78</span>
              <span className="pb-1 text-[13px] font-black text-emerald-100">/100</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/16">
              <div className="h-full w-[78%] rounded-full bg-emerald-300" />
            </div>
            <p className="m-0 mt-3 text-[12px] leading-5 text-white/72">
              {isArabic ? 'المؤشر للعرض البصري فقط ولا يمثل نتيجة محاسبية حقيقية.' : 'This score is visual-only and does not represent a real accounting result.'}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => <MetricTile key={item.key} item={item} isArabic={isArabic} />)}
      </div>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-lg border border-noorix-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="m-0 text-[15px] font-black text-noorix-text">{isArabic ? 'نبض الفترة' : 'Period pulse'}</h4>
              <p className="m-0 mt-1 text-[12px] leading-5 text-noorix-muted">
                {isArabic ? 'قراءة مرئية مختصرة لمواضع القوة والضغط في العينة.' : 'A compact visual read of strength and pressure in the sample.'}
              </p>
            </div>
            <Badge color="green" size="sm">{isArabic ? 'Jul 2026' : 'Jul 2026'}</Badge>
          </div>
          <div className="mt-5 grid gap-4">
            {flows.map((item) => <FlowStrip key={item.key} item={item} isArabic={isArabic} />)}
          </div>
        </div>

        <div className="grid gap-3">
          {signals.map((item) => <SignalPanel key={item.key} item={item} isArabic={isArabic} />)}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-noorix-border bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-noorix-border bg-noorix-bg-muted/45 px-4 py-3">
          <div className="min-w-0">
            <h4 className="m-0 text-[15px] font-black text-noorix-text">{isArabic ? 'مسار الأحداث المالية' : 'Financial event lane'}</h4>
            <p className="m-0 mt-1 text-[12px] text-noorix-muted">
              {isArabic ? 'جدول صغير داعم للفهم، وليس مركز التجربة.' : 'A small supporting table, not the center of the experience.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">{isArabic ? 'تصدير عينة' : 'Export sample'}</Button>
            <Button size="sm" variant="primary">{isArabic ? 'فتح تصور كامل' : 'Open full concept'}</Button>
          </div>
        </div>
        <SimpleTable
          columns={columns}
          data={timelineRows}
          tableMinWidth={760}
          compact
          frameClassName="border-0 shadow-none rounded-none"
          emptyMessage={isArabic ? 'لا توجد بيانات تجريبية' : 'No mock data'}
        />
      </section>
    </div>
  );
}
