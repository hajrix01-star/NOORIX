import { cn } from '../../ui/cn';

/** جذر مضمّن داخل تبويبات HR — بدون py/px إضافية */
export const HR_EMBEDDED_SHELL_CLASS = 'flex min-w-0 w-full flex-col gap-3';

/** جذر قائمة flat على الجوال — بدون فجوة بين التحكم والصفوف */
export const HR_EMBEDDED_SHELL_FLAT_CLASS = cn(HR_EMBEDDED_SHELL_CLASS, 'gap-0');

/** حشو أفقي موحّد داخل كرت HR (محاذاة المحتوى + الأزرار) */
export const HR_WORKSPACE_GUTTER_X = 'px-4 sm:px-4';

/** محتوى منطقة العمل داخل كرت التبويبات الرئيسية */
export const HR_WORKSPACE_CONTENT_CLASS =
  'nx-hr-workspace min-h-[200px] bg-noorix-surface p-0';

/** متغير CSS للهامش الأفقي — يطابق HR_WORKSPACE_GUTTER_X (px-4) */
export const HR_WORKSPACE_GUTTER_VAR_CLASS = '[--nx-hr-gutter:1rem]';

/** هامش النص داخل صف القائمة — مستقل عن غلاف التحكم (1.25rem على الجوال) */
export const HR_FLAT_TEXT_INSET_VAR_CLASS = '[--nx-hr-text-inset:1.25rem]';

export const HR_WORKSPACE_BODY_CLASS = cn(
  'nx-hr-workspace__body relative z-[1] min-w-0 w-full box-border',
  HR_WORKSPACE_GUTTER_X,
  HR_WORKSPACE_GUTTER_VAR_CLASS,
  'py-3 sm:py-4',
);

/** تبويبات القائمة — جوال: بدون px على الجسم؛ التحكم بـ --nx-hr-gutter والنص بـ --nx-hr-text-inset */
export const HR_WORKSPACE_BODY_FLAT_LIST_CLASS = cn(
  'nx-hr-workspace__body nx-hr-workspace__body--flat-list relative z-[1] min-w-0 w-full box-border',
  HR_WORKSPACE_GUTTER_VAR_CLASS,
  HR_FLAT_TEXT_INSET_VAR_CLASS,
  'py-3 sm:py-4',
  'max-md:px-0 md:px-4',
);

/** @deprecated */ export const HR_WORKSPACE_BODY_STAFF_LIST_CLASS = HR_WORKSPACE_BODY_FLAT_LIST_CLASS;
/** @deprecated */ export const HR_STAFF_TEXT_INSET_VAR_CLASS = HR_FLAT_TEXT_INSET_VAR_CLASS;

/** أزرار + فلاتر + بحث — هامش أفقي على الجوال فقط */
export const HR_TAB_CONTROLS_CLASS = cn(
  'nx-hr-tab-controls flex min-w-0 w-full flex-col gap-3 max-md:px-4',
);

/** @deprecated */ export const HR_STAFF_CONTROLS_CLASS = HR_TAB_CONTROLS_CLASS;

/** غلاف التبويبات الفرعية — pills تحت التبويبات الرئيسية (خط واحد أسفل الشريط) */
export const HR_SUBTAB_SHELL_CLASS = cn(
  'nx-hr-subtab-shell w-full',
);

/** داخل جسم المحتوى — شريط connected مسطح (بدون إطار كرت) */
export const HR_SUBTAB_INLINE_CLASS = cn(
  'nx-hr-subtab-inline w-full min-w-0 overflow-hidden',
);

/** جدول داخل مساحة HR — بدون إطار/ظل مزدوج (الكرت الخارجي يكفي) */
export const HR_WORKSPACE_TABLE_CLASS = 'nx-hr-workspace-table';

/** SmartTable flat داخل HR — إطار شفاف على الجوال */
export const HR_FLAT_TABLE_FRAME_CLASS = cn(
  HR_WORKSPACE_TABLE_CLASS,
  'nx-hr-table--flat-list noorix-table-frame--mobile-list',
);

/** غلاف قائمة flat — صفوف بعرض كرت HR */
export const HR_FLAT_LIST_CLASS = 'nx-hr-flat-list w-full min-w-0 max-md:min-h-0';

/** @deprecated */ export const HR_STAFF_LIST_CLASS = HR_FLAT_LIST_CLASS;

/** @deprecated */ export const HR_STAFF_ROW_INNER_PAD_CLASS = 'max-md:px-5 py-3';

/** @deprecated استخدم HR_SUBTAB_SHELL_CLASS */
export const HR_SEGMENTED_SHELL_FLAT_CLASS = 'nx-segmented-shell--flat';

/** @deprecated */
export const HR_SEGMENTED_SHELL_INSET_CLASS = HR_SUBTAB_SHELL_CLASS;

/** @deprecated */
export const HR_SEGMENTED_INLINE_CLASS = HR_SUBTAB_INLINE_CLASS;

/** جذر تبويبات الأدوات داخل مساحة HR */
export const HR_TOOLS_ROOT_CLASS = HR_EMBEDDED_SHELL_CLASS;

/** تبويبات HR التي تستخدم نمط القائمة المسطحة */
export const HR_FLAT_LIST_TAB_KEYS = new Set([
  'people:list',
  'people:leave',
  'people:residency',
  'payroll:runs',
  'payroll:advances',
]);

export function isHrFlatListTab(section: string, tab: string): boolean {
  return HR_FLAT_LIST_TAB_KEYS.has(`${section}:${tab}`);
}

/** props SmartTable للوضع المضمّن flat */
export function hrFlatSmartTableShellProps(embedded: boolean | undefined) {
  return embedded
    ? { innerPadding: 0 as const, frameClassName: HR_FLAT_TABLE_FRAME_CLASS }
    : { innerPadding: 8 as const };
}
