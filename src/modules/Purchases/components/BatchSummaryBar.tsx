import { memo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { SummaryBar } from '../../../ui';

export type BatchSummaryBarProps = {
  count: number;
  net: number;
  tax: number;
  total: number;
};

export const BatchSummaryBar = memo(function BatchSummaryBar({
  count,
  net,
  tax,
  total,
}: BatchSummaryBarProps) {
  const { t } = useTranslation();
  return (
    <SummaryBar
      className="mt-4"
      items={[
        { key: 'count', label: t('validInvoices'), value: count, tone: 'blue' },
        { key: 'net', label: t('net'), value: net, tone: 'green', currency: 'SR' },
        { key: 'tax', label: t('tax15'), value: tax, tone: 'amber', currency: 'SR' },
        { key: 'total', label: t('total'), value: total, currency: 'SR' },
      ]}
    />
  );
});

export default BatchSummaryBar;
