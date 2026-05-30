import { cn } from '../../ui/cn';

/** جذر مضمّن داخل تبويبات HR — بدون py/px إضافية */
export const HR_EMBEDDED_SHELL_CLASS = 'flex min-w-0 w-full flex-col gap-3';

/** حشو أفقي موحّد داخل كرت HR (محاذاة التبويبات + المحتوى + الأزرار) */
export const HR_WORKSPACE_GUTTER_X = 'px-3 sm:px-4';

/** محتوى منطقة العمل داخل كرت التبويبات الرئيسية */
export const HR_WORKSPACE_CONTENT_CLASS =
  'nx-hr-workspace min-h-[200px] bg-noorix-surface p-0';

export const HR_WORKSPACE_BODY_CLASS = cn(
  'nx-hr-workspace__body relative z-[1] min-w-0 w-full box-border',
  HR_WORKSPACE_GUTTER_X,
  'py-3 sm:py-4',
);

export const HR_SEGMENTED_SHELL_FLAT_CLASS = 'nx-segmented-shell--flat';

/** غلاف شريط التبويبات الفرعية — نفس الهامش الأفقي للمحتوى */
export const HR_SEGMENTED_SHELL_INSET_CLASS = cn(
  HR_SEGMENTED_SHELL_FLAT_CLASS,
  HR_WORKSPACE_GUTTER_X,
  'border-b border-noorix-border py-2.5 sm:py-3',
);

/** شريط segmented بعرض كامل + خلفية مسار (قائمة | إجازات | …) */
export const HR_SEGMENTED_BAR_CLASS =
  'nx-segmented-tab-bar nx-segmented-tab-bar--fill nx-segmented-tab-bar--track nx-segmented-tab-bar--hr';

/** داخل جسم المحتوى — بدون هامش إضافي على الغلاف (الهامش من الجسم) */
export const HR_SEGMENTED_INLINE_CLASS = 'nx-hr-segmented-inline w-full min-w-0';

/** جذر تبويبات الأدوات داخل مساحة HR */
export const HR_TOOLS_ROOT_CLASS = HR_EMBEDDED_SHELL_CLASS;
