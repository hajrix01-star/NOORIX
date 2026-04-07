/**
 * نافذة تفاصيل فئة من مخطط الدائري — جدول عمليات + تغيير الفئة
 */
import React, { useMemo, useState, useEffect } from 'react';
import { fmt } from '../../../utils/format';
import { getTxKey, FALLBACK_CATEGORIES } from './bankAnalysisUtils';
import { Button, Drawer, Input } from '../../../ui';
import SmartTable from '../../../components/common/SmartTable';

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
    <Drawer
      open={open && !!categoryName}
      onClose={onClose}
      title={categoryName}
      size="full"
      side="start"
      className="bank-pie-drilldown-drawer"
      footer={<Button onClick={onClose}>{t('close') || 'إغلاق'}</Button>}
    >
      <div className="nx-text-sm nx-text-muted nx-mb-12 nx-flex-center nx-flex-wrap nx-gap-16">
        <span className="nx-flex-center nx-gap-6">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--noorix-text-muted)', display: 'inline-block' }} />
          {t('bankStatementTransactions')}: <strong className="nx-text-primary">{rows.length}</strong>
        </span>
        <span className="nx-flex-center nx-gap-6">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
          {t('bankStatementColDebit')}: <strong className="nx-ltr" style={{ display: 'inline-block', color: '#dc2626' }}>{fmt(totals.debit)}</strong>
        </span>
        <span className="nx-flex-center nx-gap-6">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
          {t('bankStatementColCredit')}: <strong className="nx-ltr" style={{ display: 'inline-block', color: '#16a34a' }}>{fmt(totals.credit)}</strong>
        </span>
      </div>

      <div className="nx-overflow-auto" style={{ maxHeight: 'min(60vh, 540px)' }}>
        <SmartTable
          columns={[
            { key: 'txDate', label: t('bankStatementDate'),
              render: (v) => <span className="nx-nowrap nx-text-muted nx-text-sm">{v}</span> },
            { key: 'description', label: t('bankStatementDescription'),
              render: (v) => <div className="nx-truncate nx-text-primary" title={v}>{v}</div> },
            { key: 'debit', label: t('bankStatementColDebit'), numeric: true,
              render: (v) => (
                <span className="nx-ltr" style={{ fontWeight: Number(v) > 0 ? 700 : 400, color: Number(v) > 0 ? '#dc2626' : 'var(--noorix-text-muted)' }}>
                  {Number(v) > 0 ? fmt(Number(v)) : '—'}
                </span>
              ) },
            { key: 'credit', label: t('bankStatementColCredit'), numeric: true,
              render: (v) => (
                <span className="nx-ltr" style={{ fontWeight: Number(v) > 0 ? 700 : 400, color: Number(v) > 0 ? '#16a34a' : 'var(--noorix-text-muted)' }}>
                  {Number(v) > 0 ? fmt(Number(v)) : '—'}
                </span>
              ) },
            { key: 'category', label: t('bankStatementCategories'),
              render: (_, tx) => {
                const catId = tx.categoryId || '';
                return editingTxId === tx.id ? (
                  <div className="nx-flex-col nx-gap-6">
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
                    <div className="nx-flex nx-gap-6">
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
    </Drawer>
  );
}
