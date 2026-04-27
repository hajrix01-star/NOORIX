/**
 * Arabic copy for HR print HTML. Kept in a dedicated UTF-8 module so templates stay readable.
 * English strings live in hrPrintDocumentsTabConstants.ts.
 */

/** Shown when a field is intentionally left blank in the print layout. */
export const HR_PRINT_EMPTY_FIELD = '—';

export const HR_PRINT_AR = {
  logoPlaceholder: 'شعار',
  employeeSection: 'بيانات الموظف',
  empName: 'الاسم',
  empIqama: 'الإقامة',
  empJobTitle: 'المسمى الوظيفي',
  declarationHeading: 'نص الإقرار',
  langArabic: 'العربية',
  langEnglish: 'الإنجليزية',
  signaturesHeading: 'التوقيعات',
  sigEmployeeTitle: 'توقيع الموظف',
  sigEmployerTitle: 'ختم المنشأة وتوقيع المفوّض',
  sigDateLineSuffix: 'التاريخ: ____________________',
  footerLegalAr:
    'هذا الخطاب وجيه للاطلاع والتوقيع وفق نظام العمل السعودي (مرسوم م/51).',
  issueDateLabel: 'تاريخ الإصدار',

  eosName: 'اسم الموظف',
  eosIqama: 'رقم الإقامة',
  eosJoin: 'تاريخ البداية',
  eosEnd: 'تاريخ نهاية الخدمة',
  eosServiceDuration: 'مدة الخدمة',
  eosWageComponents: 'أجر آخر شهر (مجمع البدلات)',
  eosGratuity: 'مكافأة نهاية الخدمة',
  eosOtherDues: 'مستحقات أخرى',
  eosDeductions: 'خصومات',
  eosNet: 'صافي المستحق',
  eosEstablishment: 'اسم المنشأة',
  eosLetterTitle: 'خطاب استلام جميع المستحقات',
  eosContractBlock: 'بيانات العقد والتسوية',

  annualPayrollRange: (rangeAr: string) => `مسير رواتب ${rangeAr}`,
  annualYearOnly: (year: number) => `السنة ${year}`,
  annualTitle: (year: number) => `كشف رواتب سنة ${year}`,
  annualSalaryDetail: 'تفاصيل الرواتب',
  annualMonthCol: 'الشهر',
  annualTotalRow: (annualTotalEn: string) => `الإجمالي السنوي / ${annualTotalEn}`,

  salaryLetterTitle: 'خطاب استلام الراتب',
  salaryLetterContract: 'بيانات العقد',
  salaryEndDate: 'تاريخ الإنهاء',
  monthlySalaryAr: 'الراتب الشهري',

  slipTitlePrefix: 'مسير راتب',
  slipDetailHeading: 'تفاصيل الراتب للفترة',
  slipItemCol: 'البند',
  slipAmountCol: 'المبلغ',

  overtimeEstimateAr: 'تقدير الأوفرتايم (شهري)',
} as const;
