/**
 * Button — مكوّن الزر الموحّد لنظام نووريكس
 *
 * variants: default | primary | success | danger | warning | ghost
 * sizes:    sm | md | lg
 *
 * الاستخدام:
 *   <Button onClick={fn}>حفظ</Button>
 *   <Button variant="primary" size="lg" loading={isSaving}>حفظ</Button>
 *   <Button variant="danger" icon="🗑">حذف</Button>
 *   <Button variant="ghost" size="sm">إلغاء</Button>
 */
import React, { forwardRef } from 'react';

/** خريطة الـ class لكل variant */
const VARIANT_CLASS = {
  default: 'nx-btn--default',
  primary: 'nx-btn--primary',
  success: 'nx-btn--success',
  danger:  'nx-btn--danger',
  warning: 'nx-btn--warning',
  ghost:   'nx-btn--ghost',
  raw:     'nx-btn--raw',
};

/** خريطة الـ class لكل size */
const SIZE_CLASS = {
  sm: 'nx-btn--sm',
  md: '',
  lg: 'nx-btn--lg',
};

/**
 * @param {object} props
 * @param {'default'|'primary'|'success'|'danger'|'warning'|'ghost'} [props.variant='default']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.fullWidth=false]
 * @param {React.ReactNode} [props.icon] - أيقونة أو نص يُعرض قبل المحتوى
 * @param {React.ReactNode} [props.iconEnd] - أيقونة أو نص يُعرض بعد المحتوى
 * @param {'button'|'submit'|'reset'} [props.type='button']
 * @param {string} [props.className] - classes إضافية
 * @param {React.ReactNode} props.children
 */
const Button = forwardRef(function Button({
  variant  = 'default',
  size     = 'md',
  loading  = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconEnd,
  type     = 'button',
  className = '',
  children,
  ...rest
}, ref) {
  const classes = [
    'nx-btn',
    VARIANT_CLASS[variant] ?? VARIANT_CLASS.default,
    SIZE_CLASS[size] ?? '',
    fullWidth ? 'nx-btn--full' : '',
    loading   ? 'nx-btn--loading' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className="nx-btn__spinner" aria-hidden="true" />
      )}
      {!loading && icon && (
        <span className="nx-btn__icon" aria-hidden="true">{icon}</span>
      )}
      {children && <span className="nx-btn__label">{children}</span>}
      {!loading && iconEnd && (
        <span className="nx-btn__icon nx-btn__icon--end" aria-hidden="true">{iconEnd}</span>
      )}
    </button>
  );
});

export default Button;
