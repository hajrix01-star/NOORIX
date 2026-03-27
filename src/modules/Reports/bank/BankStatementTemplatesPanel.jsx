/**
 * مطابق BankTemplatesManager.jsx في Base44 — بطاقة تعريف، أعمدة، تفعيل/تعطيل، حذف نهائي
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { bankStatementTemplatesList, bankStatementTemplateSetActive, bankStatementTemplateDelete } from '../../../services/api';

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
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <div
        style={{
          background: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e40af', marginBottom: 6 }}>{t('bankTemplatesIntroTitle')}</div>
        <p style={{ margin: 0, fontSize: 13, color: '#1d4ed8', lineHeight: 1.5 }}>{t('bankTemplatesIntroBody')}</p>
      </div>

      {isLoading ? <p style={{ color: 'var(--noorix-text-muted)' }}>{t('loading')}…</p> : null}

      {!isLoading && !list.length ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📊</div>
          <p style={{ margin: 0, fontWeight: 600 }}>{t('bankTemplatesEmptyTitle')}</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>{t('bankTemplatesEmptySubtitle')}</p>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {sorted.map((tpl) => {
          const cols = columnsToBadges(tpl.columnsJson, t);
          const lastUsed = tpl.lastUsedAt ? new Date(tpl.lastUsedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-SA') : null;
          return (
            <div
              key={tpl.id}
              className="noorix-surface-card"
              style={{ padding: 16, opacity: tpl.isActive ? 1 : 0.6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{t('bankTemplatesColumns')}:</span>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    type="button"
                    className="noorix-btn noorix-btn--ghost"
                    title={tpl.isActive ? t('bankTemplatesDeactivateHint') : t('bankTemplatesActivateHint')}
                    disabled={toggleMut.isPending}
                    onClick={() => toggleMut.mutate({ id: tpl.id, isActive: !tpl.isActive })}
                  >
                    {tpl.isActive ? '○ ' + t('bankTemplatesToggleOff') : '✓ ' + t('bankTemplatesToggleOn')}
                  </button>
                  <button type="button" className="noorix-btn noorix-btn--ghost" style={{ color: '#dc2626' }} onClick={() => setDeleteId(tpl.id)}>
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {deleteId ? (
        <div
          className="noorix-modal-backdrop"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
          onClick={(e) => e.target === e.currentTarget && setDeleteId(null)}
        >
          <div className="noorix-surface-card" style={{ padding: 22, maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{t('bankTemplatesDeleteTitle')}</h3>
            <p style={{ fontSize: 14, color: 'var(--noorix-text-muted)' }}>{t('bankTemplatesDeleteBody')}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button type="button" className="noorix-btn noorix-btn--ghost" onClick={() => setDeleteId(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="noorix-btn noorix-btn--primary"
                style={{ background: '#dc2626' }}
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(deleteId)}
              >
                {deleteMut.isPending ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
