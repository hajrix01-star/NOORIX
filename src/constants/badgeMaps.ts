/**
 * بنّاءات خرائط الشارات — تُمرَّر إلى Badge.fromStatus(map)
 */

type Translate = (key: string, ...args: unknown[]) => string;

export function buildActiveCancelledStatusMap(t: Translate) {
  return {
    active: { color: 'green', label: t('statusActive') },
    cancelled: { color: 'red', label: t('statusCancelled') },
  };
}

export function buildActiveCancelledPartialStatusMap(t: Translate) {
  return {
    ...buildActiveCancelledStatusMap(t),
    partial: { color: 'amber', label: t('statusPartial') || 'جزئي' },
  };
}

export function buildInvoiceKindBadgeMap(t: Translate) {
  return {
    purchase: { color: 'blue', label: t('categoryTypes') },
    expense: { color: 'amber', label: t('categoryTypeExpense') },
    fixed_expense: { color: 'gray', label: t('fixedExpenseType') || 'مصروف ثابت' },
    hr_expense: { color: 'violet', label: t('invoiceKindHrExpense') || 'إقامة/HR' },
    salary: { color: 'green', label: t('totalSalary') || 'راتب' },
    advance: { color: 'amber', label: t('quickAdvance') || 'سلفية' },
    sale: { color: 'sky', label: t('categoryTypeSale') },
  };
}

/** نوع سطر مصروف (ثابت / متغير) */
export function buildExpenseLineKindBadgeMap(t: Translate) {
  return {
    fixed_expense: { color: 'gray', label: t('fixedExpenseType') || 'ثابت' },
    expense: { color: 'amber', label: t('categoryTypeExpense') || 'متغير' },
  };
}

export function buildEmployeeHrStatusMap(t: Translate) {
  return {
    active: { color: 'green', label: t('statusActive') },
    on_leave: { color: 'amber', label: t('statusOnLeave') },
    terminated: { color: 'red', label: t('statusTerminated') },
    archived: { color: 'gray', label: t('statusArchived') },
  };
}

/** طلبات الإجازة — تبويب الإجازات + ملف الموظف */
export function buildLeaveRequestStatusMap(t: Translate) {
  return {
    pending: { color: 'amber', label: t('statusPending') },
    approved: { color: 'green', label: t('statusApproved') },
    rejected: { color: 'red', label: t('statusRejected') },
  };
}

/** مسيرات الرواتب */
export function buildPayrollRunStatusMap(t: Translate) {
  return {
    draft: { color: 'gray', label: t('payrollDraft') },
    /** Approved run; treasury disbursement is separate (salary invoice on batchId). */
    completed: { color: 'blue', label: t('payrollApproved') },
  };
}

/** سجل الإقامة — expired / renewed / active */
export function buildResidencyRecordStatusMap(t: Translate) {
  return {
    expired: { color: 'red', label: t('statusExpired') },
    renewed: { color: 'green', label: t('statusRenewed') },
    active: { color: 'blue', label: t('statusActive') },
  };
}

/** تسوية السلفية — تبويب السلف */
export function buildAdvanceSettlementStatusMap(t: Translate) {
  return {
    cancelled: { color: 'gray', label: t('cancelled') },
    settled: { color: 'red', label: t('advanceSettled') },
    partial: { color: 'blue', label: t('advanceStatusPartial') },
    outstanding: { color: 'amber', label: t('advanceOutstanding') },
  };
}
