/**
 * BatchSummaryBar — شريط ملخص الدفعة (عدد الفواتير، صافي، ضريبة، إجمالي)
 * يستخدم noorix-summary-bar CSS class لتوحيد الثيم مع باقي النظام
 */
import React, { memo } from 'react';
import { fmt } from '../../../utils/format';
import { useTranslation } from '../../../i18n/useTranslation';
import { FmtNum } from '../../../ui';

export type BatchSummaryBarProps = Record<string, any>;

export const BatchSummaryBar = memo(function BatchSummaryBar(props: BatchSummaryBarProps) {
  const { count, net, tax, total } = props;
  const { t } = useTranslation();
  return (
    <div className="noorix-summary-bar noorix-summary-bar--4 mt-4">
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('validInvoices')}</div>
        <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{count}</div>
      </div>
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('net')}</div>
        <div className="noorix-summary-bar__value noorix-summary-bar__value--green"><FmtNum n={net} /> <span className="nx-sar">SR</span></div>
      </div>
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('tax15')}</div>
        <div className="noorix-summary-bar__value noorix-summary-bar__value--amber"><FmtNum n={tax} /> <span className="nx-sar">SR</span></div>
      </div>
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('total')}</div>
        <div className="noorix-summary-bar__value"><FmtNum n={total} /> <span className="nx-sar">SR</span></div>
      </div>
    </div>
  );
});

export default BatchSummaryBar;
