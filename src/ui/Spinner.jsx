/**
 * Spinner — مكوّن التحميل الموحّد لنظام نووريكس
 *
 * sizes: xs | sm | md | lg
 * colors: inherit (يرث لون الوالد) | primary | white | muted
 *
 * الاستخدام:
 *   <Spinner />                          — متوسط، ثيم أزرق
 *   <Spinner size="sm" color="white" />  — صغير أبيض (داخل زر)
 *   <Spinner size="lg" label="جاري التحميل..." /> — مع نص
 *   <Spinner.Page />                     — يملأ المنطقة المحيطة
 */
import React from 'react';

const SIZE_PX = { xs: 14, sm: 18, md: 24, lg: 36 };
const BORDER_PX = { xs: 2, sm: 2, md: 3, lg: 3 };

const COLOR_MAP = {
  primary: {
    border: 'rgba(37,99,235,0.2)',
    top:    'var(--noorix-accent-blue, #2563eb)',
  },
  white: {
    border: 'rgba(255,255,255,0.3)',
    top:    '#ffffff',
  },
  muted: {
    border: 'rgba(100,116,139,0.2)',
    top:    'var(--noorix-text-muted, #64748b)',
  },
  inherit: {
    border: 'rgba(0,0,0,0.15)',
    top:    'currentColor',
  },
};

/**
 * @param {object} props
 * @param {'xs'|'sm'|'md'|'lg'} [props.size='md']
 * @param {'primary'|'white'|'muted'|'inherit'} [props.color='primary']
 * @param {string} [props.label] - نص مرئي يُعرض أسفل الدوّار
 * @param {string} [props.className]
 */
function Spinner({
  size      = 'md',
  color     = 'primary',
  label,
  className = '',
  ...rest
}) {
  const px      = SIZE_PX[size]   ?? SIZE_PX.md;
  const border  = BORDER_PX[size] ?? BORDER_PX.md;
  const palette = COLOR_MAP[color] ?? COLOR_MAP.primary;

  return (
    <span
      className={['nx-spinner', className].filter(Boolean).join(' ')}
      role="status"
      aria-label={label ?? 'جاري التحميل'}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          display:      'inline-block',
          width:        px,
          height:       px,
          borderRadius: '50%',
          border:       `${border}px solid ${palette.border}`,
          borderTopColor: palette.top,
          animation:    'nx-spin 0.7s linear infinite',
          flexShrink:   0,
        }}
      />
      {label && (
        <span className="nx-spinner__label">{label}</span>
      )}
    </span>
  );
}

/** يملأ المنطقة المحيطة ويضع الـ Spinner في المنتصف */
Spinner.Page = function SpinnerPage({ label, size = 'lg', color = 'primary' }) {
  return (
    <div className="nx-spinner-page" role="status" aria-label={label ?? 'جاري التحميل'}>
      <Spinner size={size} color={color} aria-hidden="true" />
      {label && <p className="nx-spinner__label nx-spinner__label--page">{label}</p>}
    </div>
  );
};

export default Spinner;
