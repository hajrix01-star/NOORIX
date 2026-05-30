import { cn } from '../../ui/cn';

/** جذر مضمّن داخل تبويبات HR — بدون py/px إضافية */
export const HR_EMBEDDED_SHELL_CLASS = 'flex min-w-0 w-full flex-col gap-3';

/** حشو أفقي موحّد داخل كرت HR (محاذاة المحتوى + الأزرار) */
export const HR_WORKSPACE_GUTTER_X = 'px-3 sm:px-4';

/** محتوى منطقة العمل داخل كرت التبويبات الرئيسية */
export const HR_WORKSPACE_CONTENT_CLASS =
  'nx-hr-workspace min-h-[200px] bg-noorix-surface p-0';

export const HR_WORKSPACE_BODY_CLASS = cn(
  'nx-hr-workspace__body relative z-[1] min-w-0 w-full box-border',
  HR_WORKSPACE_GUTTER_X,
  'py-3 sm:py-4',
);

/** غلاف التبويبات الفرعية — pills تحت التبويبات الرئيسية (خط واحد أسفل الشريط) */
export const HR_SUBTAB_SHELL_CLASS = cn(
  'nx-hr-subtab-shell w-full',
);

/** شريط pills فرعي HR — fill + track */
export const HR_SECTION_SEGMENTED_BAR_CLASS =
  'nx-segmented-tab-bar nx-segmented-tab-bar--fill nx-segmented-tab-bar--track nx-segmented-tab-bar--hr';

/** داخل جسم المحتوى — شريط connected مسطح (بدون إطار كرت) */
export const HR_SUBTAB_INLINE_CLASS = cn(
  'nx-hr-subtab-inline w-full min-w-0 overflow-hidden',
);

/** جدول داخل مساحة HR — بدون إطار/ظل مزدوج (الكرت الخارجي يكفي) */
export const HR_WORKSPACE_TABLE_CLASS = 'nx-hr-workspace-table';

/** @deprecated استخدم HR_SUBTAB_SHELL_CLASS */
export const HR_SEGMENTED_SHELL_FLAT_CLASS = 'nx-segmented-shell--flat';

/** @deprecated */
export const HR_SEGMENTED_SHELL_INSET_CLASS = HR_SUBTAB_SHELL_CLASS;

/** @deprecated استخدم HR_SECTION_SEGMENTED_BAR_CLASS */
export const HR_SEGMENTED_BAR_CLASS = HR_SECTION_SEGMENTED_BAR_CLASS;

/** @deprecated */
export const HR_SEGMENTED_INLINE_CLASS = HR_SUBTAB_INLINE_CLASS;

/** جذر تبويبات الأدوات داخل مساحة HR */
export const HR_TOOLS_ROOT_CLASS = HR_EMBEDDED_SHELL_CLASS;
