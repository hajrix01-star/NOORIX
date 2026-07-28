/**
 * MetricCard — بطاقة مؤشر موحّدة (Compound Component)
 *
 * مصدر واحد للشكل المشترك بين كروت KPI ولوحة التحكم وكروت الخزائن.
 * أي تغيير في الهيكل البصري (شريط علوي، سباركلاين، حشو) يُطبَّق هنا فينعكس على كل الكروت.
 *
 * الاستخدام — كرت KPI:
 *   <MetricCard color="#185FA5" className="min-h-[168px]">
 *     <MetricCard.Header label="المبيعات" />
 *     <MetricCard.Value value={amountText(rawVal)} currency="SR" />
 *     <MetricCard.Spark data={monthlyData} color="#185FA5" grow />
 *     <MetricCard.Footer className="mt-3 border-t border-noorix-border pt-3">
 *       <span>{period}</span><span>{pct}%</span>
 *     </MetricCard.Footer>
 *   </MetricCard>
 *
 * الاستخدام — كرت خزينة:
 *   <MetricCard color={accentColor} isArchived={isArchived} onClick={...}>
 *     <MetricCard.Header label={name} subLabel={sub} icon={<Icon />} actions={<Menu />} />
 *     <MetricCard.Value label="الرصيد" value={balance} currency="SR" align="center" size="lg" ... />
 *     <MetricCard.Spark data={sparkData} color={accentColor} height={32} />
 *     <MetricCard.Divider />
 *     <MetricCard.Section className="grid grid-cols-2 gap-2 py-3">...</MetricCard.Section>
 *     <MetricCard.Footer className="flex-wrap gap-1.5 border-t border-noorix-border py-2">...</MetricCard.Footer>
 *   </MetricCard>
 */
import React, { type MouseEventHandler, type ReactNode } from 'react';
import { cn } from './cn';
import { fmt } from '../utils/format';
import { FmtNum } from './FmtNum';

export type MetricCardRootProps = {
  color?: string;
  isArchived?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
  children?: ReactNode;
};

/* ══ Root ═══════════════════════════════════════════════════════════ */
function MetricCard({ isArchived = false, onClick, className, children }: MetricCardRootProps) {
  const cardStyle = {
    '--metric-card-opacity': isArchived ? 0.65 : 1,
  } as React.CSSProperties;
  return (
    <div
      className={cn(
        'noorix-surface-card metric-card-root relative flex min-w-0 flex-col',
        onClick && 'cursor-pointer transition-[box-shadow] duration-150 hover:[box-shadow:var(--noorix-card-shadow-hover)]',
        className,
      )}
      style={cardStyle}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/* ══ Header ══════════════════════════════════════════════════════════
 * وضع الأيقونة (خزينة): icon + label + subLabel + actions على يسار/يمين
 * وضع KPI (بلا أيقونة):  label فقط أعلى اليسار
 ════════════════════════════════════════════════════════════════════ */
MetricCard.Header = function MetricCardHeader({
  label,
  subLabel,
  icon,
  actions,
  className,
}: {
  label?: ReactNode;
  subLabel?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  if (icon || actions) {
    return (
      <div className={cn('flex items-center justify-between gap-2.5 px-4 pt-[14px] pb-3', className)}>
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0">
            <div className="font-bold text-[14px] text-noorix-text truncate">{label}</div>
            {subLabel && <div className="text-[12px] text-noorix-muted mt-px truncate">{subLabel}</div>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    );
  }
  return (
    <div className={cn('px-4 pt-4', className)}>
      <div className="text-[12px] font-medium text-noorix-muted">{label}</div>
      {subLabel && <div className="text-[12px] text-noorix-muted mt-0.5">{subLabel}</div>}
    </div>
  );
};

/* ══ Value ════════════════════════════════════════════════════════════
 * value: رقم (يُنسَّق داخلياً بـ fmt) أو نص جاهز (يُعرَض كما هو)
 * label: وصف صغير فوق الرقم (مثل "الرصيد" في كرت الخزينة)
 * align: 'start' (KPI) | 'center' (خزينة)
 * size:  'md' 22px (KPI) | 'lg' 26px (خزينة)
 * prefix: مثل '−' للأرصدة السالبة
 ════════════════════════════════════════════════════════════════════ */
MetricCard.Value = function MetricCardValue({
  value,
  currency,
  label: valueLabel,
  color,
  align = 'start',
  size = 'md',
  prefix,
  className,
}: {
  value?: number | string | ReactNode;
  currency?: ReactNode;
  label?: ReactNode;
  color?: string;
  align?: string;
  size?: string;
  prefix?: ReactNode;
  className?: string;
}) {
  const isNum = typeof value === 'number';
  const absVal = isNum ? Math.abs(value) : null;
  const displayNumber = isNum ? (prefix != null ? absVal : Number(value)) : null;
  const strDisplay = !isNum ? value : null;
  const valueStyle = {
    '--metric-card-value-color': color || undefined,
  } as React.CSSProperties;
  return (
    <div
      className={cn(
        'px-4',
        align === 'center' ? 'text-center pt-[2px] pb-4' : 'mt-1',
        className,
      )}
    >
      {valueLabel && (
        <div className="text-[11px] text-noorix-muted mb-1 uppercase tracking-[0.04em]">
          {valueLabel}
        </div>
      )}
      <div
        dir="ltr"
        className={cn(
          'metric-card-value nx-font-numbers leading-tight tracking-normal text-start inline-flex items-baseline gap-x-1 flex-wrap',
          size === 'executive'
            ? 'text-[36px] font-bold leading-[1.05] tracking-normal sm:text-[48px]'
            : size === 'lg'
              ? 'text-[26px] font-extrabold'
              : 'text-[22px] font-bold',
          align === 'center' && 'justify-center w-full',
        )}
        style={valueStyle}
      >
        {prefix}
        {isNum ? <FmtNum n={Number(displayNumber)} /> : strDisplay}
        {currency && <span className="nx-sar">{currency}</span>}
      </div>
    </div>
  );
};

/* ══ Spark ════════════════════════════════════════════════════════════
 * grow: true في كروت KPI لدفع التذييل للأسفل (flex-1)
 ════════════════════════════════════════════════════════════════════ */
MetricCard.Spark = function MetricCardSpark({
  data: _data = [],
  color: _color,
  height: _height = 36,
  grow: _grow = false,
  className: _className = '',
}: {
  /** نقاط السباركلاين — `v` أو `value` أو رقم خام */
  data?: Array<number | string | null | undefined>;
  color?: string;
  height?: number;
  grow?: boolean;
  className?: string;
}) {
  void _data;
  void _color;
  void _height;
  void _grow;
  void _className;
  return null;
};

/* ══ Divider ══════════════════════════════════════════════════════════ */
MetricCard.Divider = function MetricCardDivider({ className }: { className?: string }) {
  return <div className={cn('mx-4 h-px bg-noorix-border shrink-0', className)} />;
};

/* ══ Footer ═══════════════════════════════════════════════════════════
 * شريط أفقي في أسفل الكرت — المتصل يُضيف py/border عبر className
 ════════════════════════════════════════════════════════════════════ */
MetricCard.Footer = function MetricCardFooter({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 px-4', className)}>
      {children}
    </div>
  );
};

/* ══ Section ══════════════════════════════════════════════════════════
 * قسم عام بحشو px-4 — للمحتوى الخاص (وارد/صادر في الخزينة…)
 ════════════════════════════════════════════════════════════════════ */
MetricCard.Section = function MetricCardSection({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn('px-4', className)}>{children}</div>;
};

export default MetricCard;
