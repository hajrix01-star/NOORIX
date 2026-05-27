/**
 * صفوف جوال/مضغوطة لقائمة أصناف المصاريف — محاذاة RTL، أسماء واضحة، مبالغ بمحاذاة رقمية.
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Badge, Button, FmtNum, KebabMenu } from '../../../ui';
import { cn } from '../../../ui/cn';

export type ExpenseLineRowModel = {
  id?: string;
  nameAr?: string;
  nameEn?: string;
  kind?: string;
  categoryName?: string;
  supplierName?: string;
  serviceNumber?: string;
  annualTotalAmount?: unknown;
};

type KindBadgeMap = Record<string, { color: string; label: string }>;

type AmountPair = { monthly: number | null; annual: number | null };

type RowShellProps = {
  row: ExpenseLineRowModel;
  kindBadgeMap: KindBadgeMap;
  kindShortLabel: string;
  amounts: AmountPair;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
};

function MetaLine({ row }: { row: ExpenseLineRowModel }) {
  const parts: string[] = [];
  if (row.categoryName && row.categoryName !== '—') parts.push(row.categoryName);
  if (row.supplierName && row.supplierName !== '—') parts.push(row.supplierName);
  if (row.serviceNumber) parts.push(`#${row.serviceNumber}`);
  if (parts.length === 0) return null;
  return (
    <p className="nx-expense-line-row__meta" title={parts.join(' · ')}>
      {parts.join(' · ')}
    </p>
  );
}

function AmountGrid({
  amounts,
  monthlyLabel,
  annualLabel,
}: {
  amounts: AmountPair;
  monthlyLabel: string;
  annualLabel: string;
}) {
  const { monthly, annual } = amounts;
  if (monthly == null && annual == null) return null;
  const cols = monthly != null && annual != null ? 2 : 1;
  return (
    <div
      className={cn('nx-expense-line-row__amounts', cols === 2 ? 'nx-expense-line-row__amounts--dual' : 'nx-expense-line-row__amounts--single')}
    >
      {monthly != null && (
        <div className="nx-expense-line-row__amount-cell">
          <span className="nx-expense-line-row__amount-label">{monthlyLabel}</span>
          <span className="nx-expense-line-row__amount-value" dir="ltr">
            <FmtNum n={monthly} />
            <span className="nx-sar"> SR</span>
          </span>
        </div>
      )}
      {annual != null && (
        <div className="nx-expense-line-row__amount-cell">
          <span className="nx-expense-line-row__amount-label">{annualLabel}</span>
          <span className="nx-expense-line-row__amount-value" dir="ltr">
            <FmtNum n={annual} />
            <span className="nx-sar"> SR</span>
          </span>
        </div>
      )}
    </div>
  );
}

function RowShell({
  row,
  kindBadgeMap,
  kindShortLabel,
  amounts,
  onOpen,
  onEdit,
  onDelete,
  className,
}: RowShellProps) {
  const { t } = useTranslation();
  const displayName = row.nameAr || row.nameEn || '—';
  const { color } = Badge.fromStatus(row.kind, kindBadgeMap);

  return (
    <div
      className={cn('nx-expense-line-row', className)}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="nx-expense-line-row__head">
        <Button
          type="button"
          variant="raw"
          size="auto"
          className="nx-expense-line-row__name !p-0 !h-auto !min-h-0 text-start"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {displayName}
        </Button>
        <div className="nx-expense-line-row__head-end">
          <Badge color={color} size="sm" className="max-w-[7.5rem] shrink-0 text-center leading-snug">
            {kindShortLabel}
          </Badge>
          <div className="nx-expense-line-row__kebab" onClick={(e) => e.stopPropagation()}>
            <KebabMenu
              ariaLabel={t('actions')}
              items={[
                { key: 'edit', label: t('edit'), style: { color: 'var(--noorix-accent-green)' }, onClick: onEdit },
                { key: 'delete', label: t('delete'), style: { color: 'var(--noorix-accent-red)' }, onClick: onDelete },
              ]}
            />
          </div>
        </div>
      </div>
      <MetaLine row={row} />
      <AmountGrid amounts={amounts} monthlyLabel={t('expenseLineListMonthlyAmount')} annualLabel={t('expenseLineListAnnualAmount')} />
    </div>
  );
}

export type ExpenseLineCompactRowProps = RowShellProps;

export function ExpenseLineCompactRow(props: ExpenseLineCompactRowProps) {
  return <RowShell {...props} />;
}

export type ExpenseLineMobileCardProps = RowShellProps;

/** بطاقة جوال — نفس هيكل الصف المضغوط داخل إطار البطاقة */
export function ExpenseLineMobileCard(props: ExpenseLineMobileCardProps) {
  return <RowShell {...props} className={cn(props.className, 'nx-expense-line-row--card')} />;
}

export function expenseLineKindShortLabel(
  kind: string | undefined,
  t: (key: string) => string,
): string {
  if (kind === 'fixed_expense') return t('fixedExpenseType');
  if (kind === 'expense') return t('variableExpenseType');
  return kind || '—';
}
