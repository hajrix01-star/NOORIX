/**
 * بنّاءات خرائط الشارات — تُمرَّر إلى Badge.fromStatus(map)
 */

export function buildActiveCancelledStatusMap(t) {
  return {
    active: { color: 'green', label: t('statusActive') },
    cancelled: { color: 'red', label: t('statusCancelled') },
  };
}

export function buildActiveCancelledPartialStatusMap(t) {
  return {
    ...buildActiveCancelledStatusMap(t),
    partial: { color: 'amber', label: t('statusPartial') || 'جزئي' },
  };
}

export function buildInvoiceKindBadgeMap(t) {
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
export function buildExpenseLineKindBadgeMap(t) {
  return {
    fixed_expense: { color: 'gray', label: t('fixedExpenseType') || 'ثابت' },
    expense: { color: 'amber', label: t('categoryTypeExpense') || 'متغير' },
  };
}

export function buildEmployeeHrStatusMap(t) {
  return {
    active: { color: 'green', label: t('statusActive') },
    on_leave: { color: 'amber', label: t('statusOnLeave') },
    terminated: { color: 'red', label: t('statusTerminated') },
    archived: { color: 'gray', label: t('statusArchived') },
  };
}
