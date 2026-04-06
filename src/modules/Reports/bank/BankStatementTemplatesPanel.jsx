/**
 * مطابق BankTemplatesManager.jsx في Base44 — بطاقة تعريف، أعمدة، تفعيل/تعطيل، حذف نهائي
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { bankStatementTemplatesList, bankStatementTemplateSetActive, bankStatementTemplateDelete } from '../../../services/api';
import { Button, Modal } from '../../../ui';

const COL_LABEL_KEYS = {
  date: 'bankTplColDate',
  description: 'bankTplColDescription',
  notes: 'bankTplColNotes',
  debit: 'bankTplColDebit',
  credit: 'bankTplColCredit',
  balance: 'bankTplColBalance',
  reference: 'bankTplColReference',
  amount: 'bankTplColAmount',
};

function columnsToBadges(columnsJson, t) {
  if (!columnsJson || typeof columnsJson !== 'object') return [];
  return Object.entries(columnsJson)
    .filter(([, val]) => val && typeof val.index === 'number' && val.index >= 0)
    .map(([key, val]) => ({
      key,
      label: t(COL_LABEL_KEYS[key] || key),
      index: val.index,
    }));
}

export default function BankStatementTemplatesPanel({ companyId, showToast }) {
  const { t, lang } = useTranslation();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['bank-statement-templates', companyId],
    queryFn: async () => {
      const res = await bankStatementTemplatesList(companyId);
      if (!res.success) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: !!companyId,
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, isActive }) => {
      const res = await bankStatementTemplateSetActive(companyId, id, isActive);
      if (res?.success === false) throw new Error(res?.error || 'toggle');
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-statement-templates', companyId] });
      showToast?.(t('bankTemplatesUpdated'));
    },
    onError: (e) => showToast?.(e?.message || 'Error', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const res = await bankStatementTemplateDelete(companyId, id);
      if (res?.success === false) throw new Error(res?.error || 'delete');
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-statement-templates', companyId] });
      showToast?.(t('bankTemplatesDeleted'));
      setDeleteId(null);
    },
    onError: (e) => showToast?.(e?.message || 'Error', 'error'),
  });

  const sorted = useMemo(() => [...list].sort((a, b) => (b.isActive === a.isActive ? 0 : a.isActive ? -1 : 1)), [list]);

  if (!companyId) return null;

  return (
    <div className="nx-p-16" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div
        style={{
          background: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div className="nx-font-700 nx-text-lg" style={{ color: '#1e40af', marginBottom: 6 }}>{t('bankTemplatesIntroTitle')}</div>
        <p className="nx-m-0 nx-text-base" style={{ color: '#1d4ed8', lineHeight: 1.5 }}>{t('bankTemplatesIntroBody')}</p>
      </div>

      {isLoading ? <p style={{ color: 'var(--noorix-text-muted)' }}>{t('loading')}…</p> : null}

      {!isLoading && !list.length ? (
        <div className="nx-text-center nx-text-muted" style={{ padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}></div>
          <p className="nx-m-0 nx-font-600">{t('bankTemplatesEmptyTitle')}</p>
          <p className="nx-text-base" style={{ margin: '8px 0 0' }}>{t('bankTemplatesEmptySubtitle')}</p>
        </div>
      ) : null}

      <div className="nx-grid nx-gap-12">
        {sorted.map((tpl) => {
          const cols = columnsToBadges(tpl.columnsJson, t);
          const lastUsed = tpl.lastUsedAt ? new Date(tpl.lastUsedAt).toLocaleDateString('en-GB') : null;
          return (
            <div
              key={tpl.id}
              className="noorix-surface-card"
              style={{ padding: 16, opacity: tpl.isActive ? 1 : 0.6 }}
            >
                <div className="nx-flex nx-gap-12" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="nx-flex-1" style={{ minWidth: 0 }}>
                    <div className="nx-flex nx-flex-wrap nx-gap-8" style={{ alignItems: 'center', marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{tpl.bankName || t('bankTemplatesUnspecifiedBank')}</h3>
                    {tpl.customerName ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--noorix-border)' }}>{tpl.customerName}</span>
                    ) : null}
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 10px',
                        borderRadius: 6,
                        fontWeight: 700,
                        background: tpl.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(220,38,38,0.12)',
                        color: tpl.isActive ? '#166534' : '#b91c1c',
                      }}
                    >
                      {tpl.isActive ? t('bankTemplatesStatusActive') : t('bankTemplatesStatusInactive')}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 10 }}>
                    <span>
                      # {t('bankStatementHeaderRow')}: {tpl.headerRow ?? '—'}
                    </span>
                    <span>
                      # {t('bankStatementDataStartRow')}: {tpl.dataStartRow ?? '—'}
                    </span>
                    <span>
                      {t('bankTemplatesUsedCount', String(tpl.usageCount ?? 0))}
                    </span>
                    {lastUsed ? <span>{t('bankTemplatesLastUsed', lastUsed)}</span> : null}
                  </div>
                    {cols.length > 0 ? (
                    <div className="nx-flex nx-flex-wrap nx-gap-6" style={{ alignItems: 'center' }}>
                      <span className="nx-text-sm nx-text-muted">{t('bankTemplatesColumns')}:</span>
                      {cols.map((c) => (
                        <span
                          key={c.key}
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'var(--noorix-bg-muted)',
                            border: '1px solid var(--noorix-border)',
                          }}
                        >
                          {c.label}: {c.index}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="nx-flex nx-flex-col nx-gap-6">
                  <Button
                    title={tpl.isActive ? t('bankTemplatesDeactivateHint') : t('bankTemplatesActivateHint')}
                    disabled={toggleMut.isPending}
                    onClick={() => toggleMut.mutate({ id: tpl.id, isActive: !tpl.isActive })}
                  >
                    {tpl.isActive ? '○ ' + t('bankTemplatesToggleOff') : '✓ ' + t('bankTemplatesToggleOn')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteId(tpl.id)}>{t('delete')}</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={t('bankTemplatesDeleteTitle')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>{t('cancel')}</Button>
            <Button variant="danger" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteId)}>
              {deleteMut.isPending ? t('loading') : t('delete')}
            </Button>
          </>
        }
      >
        <p className="nx-text-md nx-text-muted">{t('bankTemplatesDeleteBody')}</p>
      </Modal>
    </div>
  );
}

