/**
 * BatchSummaryBar — شريط ملخص الدفعة (عدد الفواتير، صافي، ضريبة، إجمالي)
 * يستخدم noorix-summary-bar CSS class لتوحيد الثيم مع باقي النظام
 */
import React, { memo } from 'react';
import { fmt } from '../../../utils/format';
import { useTranslation } from '../../../i18n/useTranslation';

export const BatchSummaryBar = memo(function BatchSummaryBar({ count, net, tax, total }) {
  const { t } = useTranslation();
  return (
    <div className="noorix-summary-bar noorix-summary-bar--4" style={{ marginTop: 16 }}>
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('validInvoices')}</div>
        <div className="noorix-summary-bar__value noorix-summary-bar__value--blue">{count}</div>
      </div>
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('net')}</div>
        <div className="noorix-summary-bar__value noorix-summary-bar__value--green">{fmt(net)} ﷼</div>
      </div>
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('tax15')}</div>
        <div className="noorix-summary-bar__value noorix-summary-bar__value--amber">{fmt(tax)} ﷼</div>
      </div>
      <div className="noorix-summary-bar__item">
        <div className="noorix-summary-bar__label">{t('total')}</div>
        <div className="noorix-summary-bar__value">{fmt(total)} ﷼</div>
      </div>
    </div>
  );
});

export default BatchSummaryBar;
