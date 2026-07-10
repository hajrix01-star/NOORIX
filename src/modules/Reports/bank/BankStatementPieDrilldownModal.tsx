import React, { useMemo, useState, useEffect } from 'react';
import { fmt } from '../../../utils/format';
import { getTxKey, FALLBACK_CATEGORIES } from './bankAnalysisUtils';
import { Button, AdaptiveSheet, Input, FmtNum, SmartTable } from '../../../ui';
import type { BankCategoryLite, BankCategoryOption, BankTransactionLite, TranslationFn } from './bankAnalysisTab.types';

type BankStatementPieDrilldownModalProps = {
  open: boolean;
  onClose: () => void;
  categoryName: string | null;
  transactions: readonly BankTransactionLite[];
  categories?: BankCategoryLite[];
  uncategorizedLabel: string;
  t: TranslationFn;
  onSaveTxCategory: (txId: string, categoryId: string | null) => void | Promise<void>;
  showToast: (message: string, type?: string) => void;
};

function errorMessage(error: unknown, fallback = 'Error'): string {
  return error instanceof Error ? error.message : fallback;
}

export default function BankStatementPieDrilldownModal({
  open,
  onClose,
  categoryName,
  transactions,
  categories = [],
  uncategorizedLabel,
  t,
  onSaveTxCategory,
  showToast,
}: BankStatementPieDrilldownModalProps) {
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState('');

  useEffect(() => {
    if (!open) {
      setEditingTxId(null);
      setEditingCategoryId('');
    }
  }, [open]);

  const rows = useMemo(() => {
    if (!categoryName || !transactions.length) return [];
    return transactions.filter((tx) => {
      const name = tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel;
      return name === categoryName;
    });
  }, [transactions, categoryName, uncategorizedLabel]);

  const allCategoryOptions = useMemo<BankCategoryOption[]>(() => {
    const fromDb = categories
      .filter((category): category is BankCategoryLite & { id: string } => typeof category.id === 'string' && !!category.id)
      .map((category) => ({ id: category.id, label: category.nameAr || category.nameEn || category.id }));
    if (fromDb.length > 0) return fromDb;
    return FALLBACK_CATEGORIES.map((name) => ({ id: name, label: name }));
  }, [categories]);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const tx of rows) {
      debit += Number(tx.debit) || 0;
      credit += Number(tx.credit) || 0;
    }
    return { debit, credit };
  }, [rows]);

  return (
    <AdaptiveSheet
      open={open && !!categoryName}
      onClose={onClose}
      title={categoryName}
      size="full"
      side="start"
      className="bank-pie-drilldown-drawer"
    >
      <div className="text-[12px] text-noorix-muted mb-3 flex items-center flex flex-wrap gap-4">
        <span className="flex items-center gap-6">
          <span className="w-[6px] h-[6px] rounded-full inline-block bg-noorix-muted" />
          {t('bankStatementTransactions')}: <strong className="text-noorix-text">{rows.length}</strong>
        </span>
        <span className="flex items-center gap-6">
          <span className="w-[6px] h-[6px] rounded-full inline-block bg-noorix-red" />
          {t('bankStatementColDebit')}: <strong className="nx-ltr inline-block text-noorix-red"><FmtNum n={totals.debit} /></strong>
        </span>
        <span className="flex items-center gap-6">
          <span className="w-[6px] h-[6px] rounded-full inline-block bg-noorix-green" />
          {t('bankStatementColCredit')}: <strong className="nx-ltr inline-block text-noorix-green"><FmtNum n={totals.credit} /></strong>
        </span>
      </div>

      <div className="overflow-auto max-h-[min(60vh,540px)]">
        <SmartTable
          columns={[
            {
              key: 'txDate',
              label: t('bankStatementDate'),
              render: (value) => <span className="whitespace-nowrap text-noorix-muted text-[12px]">{String(value || '')}</span>,
            },
            {
              key: 'description',
              label: t('bankStatementDescription'),
              render: (value) => <div className="truncate text-noorix-text" title={String(value || '')}>{String(value || '')}</div>,
            },
            {
              key: 'debit',
              label: t('bankStatementColDebit'),
              numeric: true,
              render: (value) => (
                <span className={`nx-ltr ${Number(value) > 0 ? 'font-bold text-noorix-red' : 'font-normal text-noorix-muted'}`}>
                  {Number(value) > 0 ? fmt(Number(value)) : '—'}
                </span>
              ),
            },
            {
              key: 'credit',
              label: t('bankStatementColCredit'),
              numeric: true,
              render: (value) => (
                <span className={`nx-ltr ${Number(value) > 0 ? 'font-bold text-noorix-green' : 'font-normal text-noorix-muted'}`}>
                  {Number(value) > 0 ? fmt(Number(value)) : '—'}
                </span>
              ),
            },
            {
              key: 'category',
              label: t('bankStatementCategories'),
              render: (_value, tx) => {
                const catId = tx.categoryId || '';
                return editingTxId === tx.id ? (
                  <div className="flex flex-col gap-1.5">
                    <Input
                      type="select"
                      value={editingCategoryId}
                      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setEditingCategoryId(event.target.value)}
                    >
                      <option value="">{uncategorizedLabel}</option>
                      {allCategoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>{category.label}</option>
                      ))}
                    </Input>
                    <div className="flex gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          try {
                            if (!tx.id) return;
                            await onSaveTxCategory(tx.id, editingCategoryId || null);
                            setEditingTxId(null);
                            showToast(t('savedSuccessfully') || 'OK');
                          } catch (error: unknown) {
                            showToast(errorMessage(error), 'error');
                          }
                        }}
                      >
                        {t('save')}
                      </Button>
                      <Button size="sm" onClick={() => setEditingTxId(null)}>{t('cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => { setEditingTxId(tx.id || null); setEditingCategoryId(catId); }}
                  >
                    {tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel}
                  </Button>
                );
              },
            },
          ]}
          data={rows}
          keyExtractor={(tx) => getTxKey(tx)}
          emptyMessage={t('bankPieDrilldownEmpty')}
        />
      </div>
    </AdaptiveSheet>
  );
}
