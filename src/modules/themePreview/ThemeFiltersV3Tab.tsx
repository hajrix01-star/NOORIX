import React, { useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { DateFilterBar, TransactionDatePicker, useDateFilter } from '../../ui/date';

export default function ThemeFiltersV3Tab() {
  const { lang } = useTranslation();
  const isArabic = lang === 'ar';
  const dateFilter = useDateFilter();
  const [transactionDate, setTransactionDate] = useState('2026-07-08');

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_48%,#eff6ff_100%)] shadow-[0_22px_55px_rgba(15,23,42,0.10)]">
        <div className="p-5">
          <div className="inline-flex h-8 items-center rounded-full border border-blue-100 bg-white px-3 text-[12px] font-black text-blue-700 shadow-sm">
            {isArabic ? 'Central Date Controls' : 'Central Date Controls'}
          </div>
          <h3 className="m-0 mt-4 text-[25px] font-black leading-tight text-slate-950">
            {isArabic ? 'فلتر مقترح 1 - الصيغة المركزية المعتمدة' : 'Proposed Filter 1 - approved central pattern'}
          </h3>
          <p className="m-0 mt-2 max-w-[900px] text-[13px] leading-6 text-slate-600">
            {isArabic
              ? 'هذه التبويبة تعرض نفس مكونات التاريخ المركزية التي يجب استخدامها في النظام: فلتر الفترة العام وتاريخ العملية. الواجهة تختار وتعرض فقط، والحسابات الرسمية تبقى في الباكند.'
              : 'This tab renders the same central date components the product should use: the global period filter and the transaction date picker. The UI selects and displays only; official calculations stay in the backend.'}
          </p>
        </div>
      </section>

      <section
        className="relative overflow-visible rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <div className="mb-3">
          <h4 className="m-0 text-[16px] font-black text-slate-950">
            {isArabic ? 'فلتر الفترة العام' : 'Global period filter'}
          </h4>
          <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
            {isArabic
              ? 'نفس المكوّن يستخدم في المشتريات والمبيعات والفواتير والتقارير ولوحات المؤشرات.'
              : 'The same component is used by purchases, sales, invoices, reports, and dashboards.'}
          </p>
        </div>
        <DateFilterBar filter={dateFilter} />
      </section>

      <section
        className="relative overflow-visible rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
        dir={isArabic ? 'rtl' : 'ltr'}
      >
        <div className="mb-3">
          <h4 className="m-0 text-[16px] font-black text-slate-950">
            {isArabic ? 'تاريخ الإدخال / تاريخ العملية' : 'Entry / transaction date'}
          </h4>
          <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
            {isArabic
              ? 'هذا هو الحقل الرسمي لتاريخ العملية في شاشات الإدخال مثل المشتريات والمبيعات.'
              : 'This is the official transaction date field for entry screens such as purchases and sales.'}
          </p>
        </div>
        <div className="max-w-[280px]">
          <TransactionDatePicker
            label={isArabic ? 'تاريخ العملية' : 'Transaction date'}
            value={transactionDate}
            onValueChange={setTransactionDate}
          />
        </div>
      </section>
    </div>
  );
}
