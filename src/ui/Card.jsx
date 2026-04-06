/**
 * Card — مكوّن البطاقات الموحّد لنظام نووريكس
 *
 * variants:
 *   surface  — بطاقة عامة (noorix-surface-card سابقاً)
 *   exec     — بطاقة إدارية بشريط لوني (للملخصات المالية)
 *   stat     — بطاقة إحصائية صغيرة (للداشبورد)
 *   plain    — بلا border/shadow (للمحتوى الداخلي)
 *
 * الاستخدام:
 *   <Card>محتوى</Card>
 *   <Card variant="exec" stripe="green" title="الإيرادات" value="50,000 ﷼" />
 *   <Card variant="stat" color="blue" label="الموظفون" value={12} />
 *   <Card padding="lg" className="mt-4">...</Card>
 */
import React from 'react';

/** ── بطاقة سطحية عامة ────────────────────────────────── */
function SurfaceCard({ padding = 'md', className = '', children, onClick, ...rest }) {
  return (
    <div
      className={[
        'nx-card',
        'nx-card--surface',
        `nx-card--pad-${padding}`,
        onClick ? 'nx-card--clickable' : '',
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

/** ── بطاقة إدارية (exec) ─────────────────────────────── */
function ExecCard({
  stripe = 'blue',
  title,
  subtitle,
  value,
  icon,
  footer,
  className = '',
  children,
  ...rest
}) {
  return (
    <div
      className={[
        'nx-card',
        'nx-card--exec',
        `nx-card--stripe-${stripe}`,
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      <div className="nx-card-exec__header">
        {icon && <span className="nx-card-exec__icon" aria-hidden="true">{icon}</span>}
        <div className="nx-card-exec__titles">
          {title    && <h3 className="nx-card-exec__title">{title}</h3>}
          {subtitle && <p  className="nx-card-exec__subtitle">{subtitle}</p>}
        </div>
      </div>
      {value !== undefined && (
        <div className="nx-card-exec__value">{value}</div>
      )}
      {children}
      {footer && <div className="nx-card-exec__footer">{footer}</div>}
    </div>
  );
}

/** ── بطاقة إحصائية (stat) ───────────────────────────── */
function StatCard({
  color   = 'blue',
  label,
  value,
  delta,
  icon,
  className = '',
  children,
  ...rest
}) {
  return (
    <div
      className={[
        'nx-card',
        'nx-card--stat',
        `nx-card--stat-${color}`,
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      <div className="nx-card-stat__stripe" aria-hidden="true" />
      <div className="nx-card-stat__body">
        {icon && <span className="nx-card-stat__icon" aria-hidden="true">{icon}</span>}
        <div className="nx-card-stat__content">
          {label !== undefined && <p  className="nx-card-stat__label">{label}</p>}
          {value !== undefined && <p  className="nx-card-stat__value">{value}</p>}
          {delta !== undefined && (
            <p className={`nx-card-stat__delta ${Number(delta) >= 0 ? 'nx-card-stat__delta--up' : 'nx-card-stat__delta--down'}`}>
              {Number(delta) >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Card — المكوّن الرئيسي
 *
 * @param {object} props
 * @param {'surface'|'exec'|'stat'|'plain'} [props.variant='surface']
 * @param {'none'|'sm'|'md'|'lg'} [props.padding='md']
 * @param {string} [props.stripe] - للـ exec: blue|green|red|amber|violet
 * @param {string} [props.color]  - للـ stat: blue|green|red|amber|violet|gray
 */
export default function Card({ variant = 'surface', ...props }) {
  if (variant === 'exec')  return <ExecCard {...props} />;
  if (variant === 'stat')  return <StatCard {...props} />;
  if (variant === 'plain') {
    const { padding = 'md', className = '', children, ...rest } = props;
    return (
      <div className={['nx-card', 'nx-card--plain', `nx-card--pad-${padding}`, className].filter(Boolean).join(' ')} {...rest}>
        {children}
      </div>
    );
  }
  return <SurfaceCard {...props} />;
}

export { SurfaceCard, ExecCard, StatCard };
