/** نوع المستند في تبويب طباعة HR (رواتب مقابل نهاية خدمة). */
export type HrPrintDocKind = 'payroll' | 'eos';

export type HrPayrollFormat = 'single' | 'annual' | 'salaryLetter';

export type HrPayrollCustomRow = { key: string; label: string; amount: string };

export type HrPayrollDraftState = {
  payrollFormat: HrPayrollFormat;
  periodLabel: string;
  companyName: string;
  companyNameEn: string;
  nameAr: string;
  nameEn: string;
  employeeSerial: string;
  jobTitle: string;
  iqama: string;
  joinDate: string;
  basic: string;
  housing: string;
  transport: string;
  other: string;
  overtime: string;
  customRows: HrPayrollCustomRow[];
  showBreakdown: boolean;
  notes: string;
  letterStartDate: string;
  letterEndDate: string;
  declarationSalariesAr: string;
  declarationSalariesEn: string;
};

export function emptyPayrollDraft(): HrPayrollDraftState {
  return {
    payrollFormat: 'single',
    periodLabel: '',
    companyName: '',
    companyNameEn: '',
    nameAr: '',
    nameEn: '',
    employeeSerial: '',
    jobTitle: '',
    iqama: '',
    joinDate: '',
    basic: '',
    housing: '',
    transport: '',
    other: '',
    overtime: '',
    customRows: [],
    showBreakdown: true,
    notes: '',
    letterStartDate: '',
    letterEndDate: '',
    declarationSalariesAr: '',
    declarationSalariesEn: '',
  };
}

export type HrAnnualDraftState = {
  year: number;
  monthOn: boolean[];
  amounts: string[];
  /** When non-empty, prefills each enabled month unless overridden in amounts[i]. */
  perMonthGross: string;
};

export function emptyAnnual(): HrAnnualDraftState {
  const y = new Date().getFullYear();
  return {
    year: y,
    monthOn: Array.from({ length: 12 }, () => true),
    amounts: Array.from({ length: 12 }, () => ''),
    perMonthGross: '',
  };
}

export type HrEosCustomRow = { key: string; label: string; amount: string };

export type HrEosDraftState = {
  companyName: string;
  companyNameEn: string;
  nameAr: string;
  nameEn: string;
  employeeSerial: string;
  jobTitle: string;
  iqama: string;
  joinDate: string;
  endDate: string;
  basic: string;
  housing: string;
  transport: string;
  other: string;
  customRows: HrEosCustomRow[];
  eosAmount: string;
  otherAccrued: string;
  deductions: string;
  netPayable: string;
  settlementNotesAr: string;
  settlementNotesEn: string;
};

export function emptyEosDraft(): HrEosDraftState {
  return {
    companyName: '',
    companyNameEn: '',
    nameAr: '',
    nameEn: '',
    employeeSerial: '',
    jobTitle: '',
    iqama: '',
    joinDate: '',
    endDate: '',
    basic: '',
    housing: '',
    transport: '',
    other: '',
    customRows: [],
    eosAmount: '',
    otherAccrued: '',
    deductions: '',
    netPayable: '',
    settlementNotesAr: '',
    settlementNotesEn: '',
  };
}
