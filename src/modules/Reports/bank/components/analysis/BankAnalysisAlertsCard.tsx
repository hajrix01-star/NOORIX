import React from 'react';
import { Button, FmtNum } from '../../../../../ui';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { BankAnalysisCardShell } from './BankAnalysisCardShell';

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
  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardAlerts')}
      icon="⚠"
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      {alerts.length === 0 ? (
        <p className="text-noorix-muted text-[13px]">لا توجد سحوبات.</p>
      ) : (
        <div className="grid gap-2.5">
          <div className="overflow-auto rounded-lg border border-noorix-border">
            <table className="w-full text-[12px] nx-table-collapse">
              <thead>
                <tr className="bg-noorix-bg-muted border-b border-noorix-border">
                  <th className="font-bold nx-th-pad">التاريخ</th>
                  <th className="font-bold nx-th-pad">الوصف</th>
                  <th className="font-bold whitespace-nowrap nx-th-pad">المبلغ</th>
                  <th className="font-bold nx-th-pad-center w-[100px]">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((tx, i) => (
                  <tr key={i} className={`nx-bank-row ${i % 2 ? 'nx-bank-row--b' : 'nx-bank-row--a'}`}>
                    <td className="text-noorix-muted whitespace-nowrap nx-td-pad">{tx.txDate}</td>
                    <td className="nx-td-pad max-w-[360px]">
                      <div className="truncate" title={tx.description || ''}>
                        {tx.description || '—'}
                      </div>
                    </td>
                    <td className="text-end nx-ltr font-extrabold text-noorix-red whitespace-nowrap nx-td-pad">
                      <FmtNum n={Number(tx.debit)} />
                    </td>
                    <td className="text-center nx-td-pad">
                      <Button
                        size="sm"
                        onClick={() => {
                          setTypeFilter('debit');
                          setActiveTab('transactions');
                        }}
                      >
                        {t('bankViewTransactions')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </BankAnalysisCardShell>
  );
}
