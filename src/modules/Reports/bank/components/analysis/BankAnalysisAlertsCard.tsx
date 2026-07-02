import React from 'react';
import { Button, FmtNum, SimpleTable } from '../../../../../ui';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { BankAnalysisCardShell } from './BankAnalysisCardShell';

type AlertRow = { id: number; txDate?: string; description?: string; debit?: unknown };

export function BankAnalysisAlertsCard({
  cardId,
  alerts,
  t,
  removeLabel,
  onRemoveCard,
  setTypeFilter,
  setActiveTab,
}: {
  cardId: AnalysisCardId;
  alerts: Array<{ txDate?: string; description?: string; debit?: unknown }>;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
  setTypeFilter: (v: string) => void;
  setActiveTab: (tab: string) => void;
}) {
  const rows: AlertRow[] = alerts.map((tx, index) => ({ ...tx, id: index }));

  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardAlerts')}
      icon="!"
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      {alerts.length === 0 ? (
        <p className="text-noorix-muted text-[13px]">لا توجد سحوبات.</p>
      ) : (
        <div className="grid gap-2.5">
          <SimpleTable<AlertRow>
            data={rows}
            tableClassName="text-[12px] nx-table-collapse"
            frameClassName="rounded-lg border border-noorix-border"
            getRowClassName={(_tx, index) => `nx-bank-row ${index % 2 ? 'nx-bank-row--b' : 'nx-bank-row--a'}`}
            columns={[
              {
                key: 'txDate',
                label: 'التاريخ',
                cellClassName: 'text-noorix-muted whitespace-nowrap nx-td-pad',
              },
              {
                key: 'description',
                label: 'الوصف',
                cellClassName: 'nx-td-pad max-w-[360px]',
                render: (value) => (
                  <div className="truncate" title={String(value || '')}>
                    {String(value || '-')}
                  </div>
                ),
              },
              {
                key: 'debit',
                label: 'المبلغ',
                numeric: true,
                cellClassName: 'text-end nx-ltr font-extrabold text-noorix-red whitespace-nowrap nx-td-pad',
                render: (value) => <FmtNum n={Number(value)} />,
              },
              {
                key: 'action',
                label: 'إجراء',
                align: 'center',
                cellClassName: 'text-center nx-td-pad',
                render: () => (
                  <Button
                    size="sm"
                    onClick={() => {
                      setTypeFilter('debit');
                      setActiveTab('transactions');
                    }}
                  >
                    {t('bankViewTransactions')}
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}
    </BankAnalysisCardShell>
  );
}
