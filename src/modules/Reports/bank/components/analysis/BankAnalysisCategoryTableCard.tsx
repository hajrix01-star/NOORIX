import React from 'react';
import type { MoneyLang } from '../../../../../utils/money';
import { formatNumber } from '../../../../../utils/money';
import { FmtNum, SimpleTable } from '../../../../../ui';
import type { AnalysisCardId, CategoryTableRow } from '../../bankAnalysisTab.types';
import { ANALYSIS_CARD_COLORS } from '../../bankAnalysisConstants';
import { BankAnalysisCardShell, BankAnalysisProgressBar } from './BankAnalysisCardShell';

type CategoryRow = CategoryTableRow & { id: string };

export function BankAnalysisCategoryTableCard({
  cardId,
  categoryRows,
  totalDebit,
  totalCredit,
  moneyLang,
  t,
  removeLabel,
  onRemoveCard,
  setCategoryFilter,
  setActiveTab,
}: {
  cardId: AnalysisCardId;
  categoryRows: CategoryTableRow[];
  totalDebit: number;
  totalCredit: number;
  moneyLang: MoneyLang;
  t: (k: string) => string;
  removeLabel: string;
  onRemoveCard: (id: AnalysisCardId) => void;
  setCategoryFilter: (name: string) => void;
  setActiveTab: (tab: string) => void;
}) {
  const rows: CategoryRow[] = categoryRows.map((row) => ({ ...row, id: row.name }));

  return (
    <BankAnalysisCardShell
      cardId={cardId}
      title={t('bankCardCategoryTable')}
      icon=""
      onRemove={onRemoveCard}
      removeLabel={removeLabel}
    >
      <SimpleTable<CategoryRow>
        data={rows}
        tableClassName="text-[12px] nx-table-collapse nx-table-min-540"
        getRowClassName={(_row, index) => `nx-bank-row nx-bank-row--click ${index % 2 === 0 ? 'nx-bank-row--a' : 'nx-bank-row--b'}`}
        onRowClick={(row) => {
          setCategoryFilter(row.name);
          setActiveTab('transactions');
        }}
        columns={[
          {
            key: 'name',
            label: 'الفئة',
            cellClassName: 'nx-td-pad-9',
            render: (value, _row, index) => (
              <div className="flex items-center gap-7">
                <span
                  className="nx-bank-dot-8"
                  style={{ background: ANALYSIS_CARD_COLORS[index % ANALYSIS_CARD_COLORS.length] }}
                />
                {String(value)}
              </div>
            ),
          },
          { key: 'count', label: 'العمليات', align: 'center', cellClassName: 'text-center text-noorix-muted nx-td-pad-9' },
          {
            key: 'debit',
            label: 'السحوبات',
            numeric: true,
            cellClassName: 'text-end nx-ltr nx-td-pad-9',
            render: (value) => {
              const amount = Number(value);
              return (
                <span className={amount > 0 ? 'text-noorix-red font-bold' : 'text-noorix-muted font-normal'}>
                  {amount > 0 ? formatNumber(amount, moneyLang) : '-'}
                </span>
              );
            },
          },
          {
            key: 'credit',
            label: 'الإيداعات',
            numeric: true,
            cellClassName: 'text-end nx-ltr nx-td-pad-9',
            render: (value) => {
              const amount = Number(value);
              return (
                <span className={amount > 0 ? 'text-noorix-green font-bold' : 'text-noorix-muted font-normal'}>
                  {amount > 0 ? formatNumber(amount, moneyLang) : '-'}
                </span>
              );
            },
          },
          {
            key: 'debitPct',
            label: 'النسبة (سحب)',
            cellClassName: 'nx-td-pad-9',
            render: (value, row, index) => (
              <div className="flex items-center gap-8">
                <BankAnalysisProgressBar
                  value={row.debit}
                  max={totalDebit}
                  color={ANALYSIS_CARD_COLORS[index % ANALYSIS_CARD_COLORS.length]}
                />
                <span className="text-noorix-muted shrink-0 min-w-[38px] nx-ltr text-start">
                  {Number(value).toFixed(1)}%
                </span>
              </div>
            ),
          },
        ]}
        footer={(
          <tr className="font-extrabold bg-noorix-bg-muted border-t-2 border-noorix-border">
            <td className="nx-td-pad-10">الإجمالي</td>
            <td className="text-center nx-td-pad-10">{categoryRows.reduce((s, r) => s + r.count, 0)}</td>
            <td className="text-end nx-ltr text-noorix-red nx-td-pad-10"><FmtNum n={totalDebit} /></td>
            <td className="text-end nx-ltr text-noorix-green nx-td-pad-10"><FmtNum n={totalCredit} /></td>
            <td className="text-noorix-muted nx-td-pad-10">100%</td>
          </tr>
        )}
      />
    </BankAnalysisCardShell>
  );
}
