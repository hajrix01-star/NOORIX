import React from 'react';
import { FmtNum, SimpleTable } from '../../../../../ui';
import type { AnalysisCardId } from '../../bankAnalysisTab.types';
import { analysisCardColorClass } from '../../bankAnalysisConstants';
import { BankAnalysisCardShell, BankAnalysisProgressBar } from './BankAnalysisCardShell';

type DepositRow = { id: string; name: string; count: number; total: number; rowNumber: number; pct: number };

export function BankAnalysisDepositsTableCard({
  cardId,
  depositsByCategory,
  t,
  removeLabel,
  onRemoveCard,
  setCategoryFilter,
  setTypeFilter,
  setActiveTab,
}: {
  cardId: AnalysisCardId;
  depositsByCategory: Array<{ name: string; count: number; total: number }>;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
  setCategoryFilter: (name: string) => void;
  setTypeFilter: (v: string) => void;
  setActiveTab: (tab: string) => void;
}) {
  const totalDep = depositsByCategory.reduce((s, r) => s + r.total, 0);
  const rows: DepositRow[] = depositsByCategory.map((row, index) => ({
    ...row,
    id: row.name,
    rowNumber: index + 1,
    pct: totalDep > 0 ? (row.total / totalDep) * 100 : 0,
  }));

  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardDepositsTable')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      {depositsByCategory.length === 0 ? (
        <p className="text-noorix-muted text-[13px]">لا توجد إيداعات.</p>
      ) : (
        <SimpleTable<DepositRow>
          data={rows}
          tableClassName="text-[12px] nx-table-collapse nx-table-min-400"
          getRowClassName={(_row, index) => `nx-bank-row nx-bank-row--click ${index % 2 === 0 ? 'nx-bank-row--a' : 'nx-bank-row--b'}`}
          onRowClick={(row) => {
            setCategoryFilter(row.name);
            setTypeFilter('credit');
            setActiveTab('transactions');
          }}
          columns={[
            { key: 'rowNumber', label: '#', cellClassName: 'text-noorix-muted font-bold nx-td-pad-9' },
            {
              key: 'name',
              label: 'الفئة',
              cellClassName: 'nx-td-pad-9',
              render: (value, _row, index) => (
                <div className="flex items-center gap-7">
                  <span className={`nx-bank-dot-8 ${analysisCardColorClass(index)}`} />
                  {String(value)}
                </div>
              ),
            },
            { key: 'count', label: 'العمليات', align: 'center', cellClassName: 'text-center text-noorix-muted nx-td-pad-9' },
            {
              key: 'total',
              label: 'إجمالي الإيداعات',
              numeric: true,
              cellClassName: 'text-end nx-ltr text-noorix-green font-bold nx-td-pad-9',
              render: (value) => <FmtNum n={Number(value)} />,
            },
            {
              key: 'pct',
              label: 'النسبة',
              cellClassName: 'nx-td-pad-9',
              render: (value, row) => (
                <div className="flex items-center gap-8">
                  <BankAnalysisProgressBar value={row.total} max={totalDep} color="#16a34a" />
                  <span className="text-noorix-muted shrink-0 min-w-[38px] nx-ltr text-start">
                    {Number(value).toFixed(1)}%
                  </span>
                </div>
              ),
            },
          ]}
          footer={(
            <tr className="font-extrabold bg-noorix-bg-muted border-t-2 border-noorix-border">
              <td colSpan={2} className="nx-td-pad-10">الإجمالي</td>
              <td className="text-center nx-td-pad-10">{depositsByCategory.reduce((s, r) => s + r.count, 0)}</td>
              <td className="text-end nx-ltr text-noorix-green nx-td-pad-10"><FmtNum n={totalDep} /></td>
              <td className="text-noorix-muted nx-td-pad-10">100%</td>
            </tr>
          )}
        />
      )}
    </BankAnalysisCardShell>
  );
}
