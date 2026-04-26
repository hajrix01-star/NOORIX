/**
 * نافذة تفاصيل فئة من مخطط الدائري — جدول عمليات + تغيير الفئة
 */
import React, { useMemo, useState, useEffect } from 'react';
import { fmt } from '../../../utils/format';
import { getTxKey, FALLBACK_CATEGORIES } from './bankAnalysisUtils';
import { Button, AdaptiveSheet, Input, FmtNum, SmartTable } from '../../../ui';

export default function BankStatementPieDrilldownModal({
  open,
  onClose,
  categoryName,
  transactions,
  categories,
  uncategorizedLabel,
  t,
  onSaveTxCategory,
  showToast,
}) {
  const [editingTxId, setEditingTxId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState('');

  useEffect(() => {
    if (!open) {
      setEditingTxId(null);
      setEditingCategoryId('');
    }
  }, [open]);

  const rows = useMemo(() => {
    if (!categoryName || !transactions?.length) return [];
    return transactions.filter((tx) => {
      const n = tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel;
      return n === categoryName;
    });
  }, [transactions, categoryName, uncategorizedLabel]);

  const allCategoryOptions = useMemo(() => {
    const fromDb = (categories || []).map((c) => ({ id: c.id, label: c.nameAr || c.nameEn }));
    if (fromDb.length > 0) return fromDb;
    return FALLBACK_CATEGORIES.map((name) => ({ id: name, label: name }));
  }, [categories]);

  const totals = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const tx of rows) {
      d += Number(tx.debit) || 0;
      c += Number(tx.credit) || 0;
    }
    return { debit: d, credit: c };
  }, [rows]);

  return (
    <AdaptiveSheet
      open={open && !!categoryName}
      onClose={onClose}
      title={categoryName}
      size="full"
      side="start"
      className="bank-pie-drilldown-drawer"
      footer={<Button onClick={onClose}>{t('close') || 'إغلاق'}</Button>}
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
            { key: 'txDate', label: t('bankStatementDate'),
              render: (v) => <span className="whitespace-nowrap text-noorix-muted text-[12px]">{v}</span> },
            { key: 'description', label: t('bankStatementDescription'),
              render: (v) => <div className="truncate text-noorix-text" title={v}>{v}</div> },
            { key: 'debit', label: t('bankStatementColDebit'), numeric: true,
              render: (v) => (
                <span className="nx-ltr" style={{ fontWeight: Number(v) > 0 ? 700 : 400, color: Number(v) > 0 ? 'var(--noorix-accent-red)' : 'var(--noorix-text-muted)' }}>
                  {Number(v) > 0 ? fmt(Number(v)) : '—'}
                </span>
              ) },
            { key: 'credit', label: t('bankStatementColCredit'), numeric: true,
              render: (v) => (
                <span className="nx-ltr" style={{ fontWeight: Number(v) > 0 ? 700 : 400, color: Number(v) > 0 ? 'var(--noorix-accent-green)' : 'var(--noorix-text-muted)' }}>
                  {Number(v) > 0 ? fmt(Number(v)) : '—'}
                </span>
              ) },
            { key: 'category', label: t('bankStatementCategories'),
              render: (_, tx) => {
                const catId = tx.categoryId || '';
                return editingTxId === tx.id ? (
                  <div className="flex flex-col gap-1.5">
                    <Input
                      type="select"
                      value={editingCategoryId}
                      onChange={(e) => setEditingCategoryId(e.target.value)}
                    >
                      <option value="">{uncategorizedLabel}</option>
                      {allCategoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </Input>
                    <div className="flex gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          try {
                            await onSaveTxCategory(tx.id, editingCategoryId || null);
                            setEditingTxId(null);
                            showToast?.(t('savedSuccessfully') || 'OK');
                          } catch (e) {
                            showToast?.(e?.message || 'Error', 'error');
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
                    onClick={() => { setEditingTxId(tx.id); setEditingCategoryId(catId); }}
                  >
                    {tx.category?.nameAr || tx.category?.nameEn || uncategorizedLabel}
                  </Button>
                );
              } },
          ]}
          data={rows}
          keyExtractor={(tx) => getTxKey(tx)}
          emptyMessage={t('bankPieDrilldownEmpty')}
        />
      </div>
    </AdaptiveSheet>
  );
}
