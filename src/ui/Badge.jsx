/**
 * Badge — مكوّن شارة الحالة الموحّد لنظام نووريكس
 *
 * colors: green | red | amber | blue | violet | gray | sky
 * وكذلك دعم الألوان المباشرة عبر colorMap المخصص
 *
 * الاستخدام:
 *   <Badge color="green">نشط</Badge>
 *   <Badge color="red" dot>ملغي</Badge>
 *   <Badge color="amber" size="sm">معلّق</Badge>
 *
 * مساعد: Badge.fromStatus(status, map) — يربط قيمة حالة بالـ color تلقائياً
 *
 * مثال مع حالات نظام:
 *   const STATUS_MAP = {
 *     pending:   { color: 'amber', label: 'معلّق' },
 *     approved:  { color: 'green', label: 'موافق' },
 *     rejected:  { color: 'red',   label: 'مرفوض' },
 *   };
 *   <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} />
 */
import React from 'react';

/** ألوان مُدمجة — كل لون له خلفية خفيفة + لون نص */
export const BADGE_COLORS = {
  green:  { bg: 'rgba(22,163,74,0.1)',  color: '#15803d' },
  red:    { bg: 'rgba(220,38,38,0.1)',  color: '#b91c1c' },
  amber:  { bg: 'rgba(217,119,6,0.12)', color: '#b45309' },
  blue:   { bg: 'rgba(37,99,235,0.1)',  color: '#1d4ed8' },
  sky:    { bg: 'rgba(2,132,199,0.1)',  color: '#0369a1' },
  violet: { bg: 'rgba(99,102,241,0.1)', color: '#4f46e5' },
  gray:   { bg: 'rgba(100,116,139,0.1)',color: '#475569' },
  navy:   { bg: 'rgba(10,31,68,0.1)',   color: '#0a1f44'  },
};

/**
 * @param {object} props
 * @param {keyof typeof BADGE_COLORS} [props.color='gray']
 * @param {'sm'|'md'} [props.size='md']
 * @param {boolean} [props.dot] - نقطة ملوّنة قبل النص
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Badge({
  color = 'gray',
  size  = 'md',
  dot   = false,
  className = '',
  children,
  ...rest
}) {
  const palette = BADGE_COLORS[color] ?? BADGE_COLORS.gray;

  return (
    <span
      className={[
        'nx-badge',
        `nx-badge--${size}`,
        className,
      ].filter(Boolean).join(' ')}
      style={{
        background: palette.bg,
        color: palette.color,
      }}
      {...rest}
    >
      {dot && (
        <span
          className="nx-badge__dot"
          style={{ background: palette.color }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

/**
 * Badge.fromStatus — مساعد لتحويل قيمة حالة إلى props الـ Badge
 *
 * @param {string} status - قيمة الحالة (مثل 'pending', 'approved')
 * @param {Record<string, {color: string, label: string}>} map
 * @returns {{ color: string, children: string }}
 *
 * مثال:
 *   <Badge {...Badge.fromStatus(row.status, STATUS_MAP)} />
 */
Badge.fromStatus = function fromStatus(status, map) {
  const entry = map?.[status];
  return {
    color: entry?.color ?? 'gray',
    children: entry?.label ?? status ?? '—',
  };
};
