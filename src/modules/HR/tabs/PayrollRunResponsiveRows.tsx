import { Link } from 'react-router-dom';
import type { KeyboardEvent } from 'react';
import { Badge } from '../../../ui';
import { payrollSalaryInvoiceListHref } from '../utils/payrollSalaryInvoiceHref';
import { hrFmt } from '../utils/hrFmt';
import type { PayrollRunRow } from './payrollTabModel';

type Translate = (key: string) => string;
type BadgeProps = ReturnType<typeof Badge.fromStatus>;

type PayrollRunResponsiveRowProps = {
  row: PayrollRunRow;
  t: Translate;
  badgeProps: BadgeProps;
  onOpen: (id: string) => void;
};

function keyboardOpenHandler(id: string, onOpen: (id: string) => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') onOpen(id);
  };
}

export function PayrollRunMobileCard({ row, t, badgeProps, onOpen }: PayrollRunResponsiveRowProps) {
  return (
    <div
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row.id)}
      onKeyDown={keyboardOpenHandler(row.id, onOpen)}
    >
      <div className="flex items-center justify-between flex flex-wrap mb-1">
        <span className="nx-cell-num nx-cell-accent text-[14px]">{row.runNumber}</span>
        <Badge {...badgeProps} size="sm" className="shrink-0" />
      </div>
      {row.month && <div className="nx-cell-muted mb-2 text-end">{row.month}</div>}
      <div className="nx-mc__grid nx-mc__grid--2 mb-2.5">
        <div>
          <div className="nx-mc__stat-label">{t('payrollGross')}</div>
          <div className="nx-mc__stat-value text-[14px]">{hrFmt(row.grossTotal)}</div>
        </div>
        <div>
          <div className="nx-mc__stat-label">{t('payrollNet')}</div>
          <div className="nx-mc__stat-value text-[15px] font-extrabold text-noorix-green">{hrFmt(row.netTotal)}</div>
        </div>
      </div>
      {row.issuedInvoiceNumber && (
        <div className="nx-cell-muted mb-2 text-end text-[12px]" dir="ltr">
          {t('payrollIssuedInvoiceNumber')}:{' '}
          <Link
            to={payrollSalaryInvoiceListHref(row.id, row.monthRaw)}
            className="font-semibold text-noorix-blue hover:underline"
            title={t('payrollOpenIssuedInvoice')}
            onClick={(event) => event.stopPropagation()}
          >
            {row.issuedInvoiceNumber}
          </Link>
        </div>
      )}
    </div>
  );
}

export function PayrollRunCompactRow({ row, t, badgeProps, onOpen }: PayrollRunResponsiveRowProps) {
  return (
    <div
      className="cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row.id)}
      onKeyDown={keyboardOpenHandler(row.id, onOpen)}
    >
      <div className="nx-cr__line1">
        <span className="nx-cr__id">{row.runNumber}</span>
        <span className="nx-cr__sub">{row.month}</span>
        <Badge {...badgeProps} size="sm" />
      </div>
      <div className="nx-cr__line2">
        <div className="nx-cr__line2-start">
          <span className="nx-cr__meta">{t('payrollGross')}: <span className="text-noorix-text">{hrFmt(row.grossTotal)}</span></span>
        </div>
        <div className="nx-cr__line2-end">
          <span className="nx-cr__amount text-noorix-green">{hrFmt(row.netTotal)} <span className="nx-sar">SR</span></span>
        </div>
      </div>
    </div>
  );
}
