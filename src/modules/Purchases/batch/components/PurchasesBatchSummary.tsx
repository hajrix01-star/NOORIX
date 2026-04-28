import React from 'react';
import { Button } from '../../../../ui';
import { BatchSummaryBar } from '../../components/BatchSummaryBar';

export interface PurchasesBatchSummaryProps {
  count: number;
  net: number;
  tax: number;
  total: number;
  savePending: boolean;
  saveDisabled: boolean;
  onSave: () => void;
  t: (key: string, ...args: any[]) => string;
}

export default function PurchasesBatchSummary(props: PurchasesBatchSummaryProps) {
  const { count, net, tax, total, savePending, saveDisabled, onSave, t } = props;
  return (
    <>
      <BatchSummaryBar count={count} net={net} tax={tax} total={total} />

      <div className="nx-toolbar mt-5">
        <Button
          size="sm"
          variant="primary"
          disabled={saveDisabled}
          onClick={onSave}
          className="flex-[1_1_200px] min-w-0"
        >
          {savePending ? t('saving') : t('saveBatch', count)}
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          {t('print')}
        </Button>
      </div>
    </>
  );
}
