/**
 * FormRow — مساعد تخطيط النماذج
 *
 * يعرض حقلين أو أكثر في صف واحد على الشاشات الكبيرة،
 * وعمود واحد على الجوال تلقائياً.
 *
 * الاستخدام:
 *   <FormRow>
 *     <Input label="الاسم الأول" ... />
 *     <Input label="الاسم الأخير" ... />
 *   </FormRow>
 *
 *   <FormRow cols={3}>
 *     <Input label="المدينة" ... />
 *     <Input label="الدولة" ... />
 *     <Input label="الرمز البريدي" ... />
 *   </FormRow>
 */
import React from 'react';

/**
 * @param {object} props
 * @param {1|2|3|4} [props.cols=2]
 * @param {'sm'|'md'|'lg'} [props.gap='md']
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function FormRow({ cols = 2, gap = 'md', className = '', children, ...rest }) {
  return (
    <div
      className={[
        'nx-form-row',
        `nx-form-row--cols-${cols}`,
        `nx-form-row--gap-${gap}`,
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
