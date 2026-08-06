import { describe, expect, it } from 'vitest';
import { buildPayrollRunEmployeeSlipsPrintHtml } from './payrollRunSignatureSlipsPrint';

const labels: Record<string, string> = {
  windowTitle: 'مسيرات الرواتب',
  legalRefAr: 'مرجع نظامي',
  legalRefEn: 'Legal reference',
  docTitleAr: 'مسير راتب — استلام وتوقيع',
  docTitleEn: 'Payroll slip — receipt & signature',
  runLabel: 'رقم المسير',
  lblPayrollMonth: 'شهر المسير',
  sectionEmpAr: 'بيانات الموظف',
  sectionEmpEn: 'Employee',
  lblName: 'الاسم',
  lblIqama: 'رقم الإقامة',
  lblJob: 'المسمى الوظيفي',
  lblSerial: 'الرقم الوظيفي',
  lblJoin: 'تاريخ الالتحاق',
  sectionBreakdownAr: 'تفاصيل الاستحقاق',
  sectionBreakdownEn: 'Breakdown',
  colItem: 'البند',
  colAmount: 'المبلغ',
  rowGross: 'الراتب الإجمالي',
  rowAllowances: 'البدلات',
  rowBeforeDed: 'الإجمالي قبل الخصم',
  rowDeductions: 'الخصومات',
  rowAdvances: 'خصم السلف',
  rowNet: 'صافي الراتب',
  netPayableTitle: 'صافي الراتب المستحق',
  netPayableTitleEn: 'Net pay due',
  netOnlyNoteAr: 'المبلغ هو الصافي بعد الخصومات.',
  netOnlyNoteEn: 'The amount is net of deductions.',
  declarationAr: 'إقرار الاستلام.',
  declarationEn: 'Receipt acknowledgement.',
  sectionSigAr: 'التوقيعات',
  sectionSigEn: 'Signatures',
  sigEmployeeAr: 'توقيع الموظف',
  sigEmployeeEn: 'Employee signature',
  sigEmployerAr: 'توقيع المنشأة',
  sigEmployerEn: 'Employer signature',
  sigDateLine: 'التاريخ: __________',
  footerLeft: 'للاطلاع والتوقيع',
  issueLabel: 'تاريخ الإصدار',
};

const run = {
  runNumber: 'PR-2608-001',
  payrollMonth: '2026-08-01',
  items: [
    {
      employee: {
        nameAr: '<نورة>',
        nameEn: 'Noura',
        iqamaNumber: '2570109146',
        employeeSerial: 'AR-ST-024',
        jobTitle: 'المحاسبة',
        joinDate: '2026-03-01',
      },
      grossSalary: 1800,
      allowancesAdd: 100,
      deductions: 200,
      netSalary: 1700,
    },
  ],
};

describe('buildPayrollRunEmployeeSlipsPrintHtml', () => {
  it('builds the simplified net-pay layout and escapes employee data', () => {
    const html = buildPayrollRunEmployeeSlipsPrintHtml({
      run,
      companyName: 'ARZ',
      companyNameEn: 'ARZ',
      lang: 'ar',
      labels,
      netOnly: true,
    });

    expect(html).toContain('class="ps-net-card"');
    expect(html).not.toContain('class="ps-table"');
    expect(html).toContain('&lt;نورة&gt;');
    expect(html).toContain('SAR</span>1,700');
    expect(html).toContain('class="ps-declaration"');
    expect(html).not.toContain('class="ps-co-en"');
    expect(html.match(/<div class="ps-slip">/g)).toHaveLength(1);
  });

  it('keeps the full payroll breakdown in the refined table layout', () => {
    const html = buildPayrollRunEmployeeSlipsPrintHtml({
      run,
      companyName: 'شركة نوركس',
      companyNameEn: 'Noorix',
      lang: 'ar',
      labels,
      netOnly: false,
    });

    expect(html).toContain('class="ps-table"');
    expect(html).toContain('SAR 1,800');
    expect(html).toContain('SAR 1,700');
    expect(html).toContain('class="ps-co-en">Noorix');
  });

  it('returns an empty string when the run has no employees', () => {
    expect(
      buildPayrollRunEmployeeSlipsPrintHtml({
        run: { items: [] },
        companyName: 'Noorix',
        lang: 'ar',
        labels,
        netOnly: true,
      }),
    ).toBe('');
  });
});
