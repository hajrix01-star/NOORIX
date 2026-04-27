/**
 * مطابق BankTemplatesManager.jsx في Base44 — بطاقة تعريف، أعمدة، تفعيل/تعطيل، حذف نهائي
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useTranslation } from '../../../i18n/useTranslation';
import { bankStatementTemplatesList, bankStatementTemplateSetActive, bankStatementTemplateDelete, throwIfApiFailed } from '../../../services/api';
import { Button, Modal } from '../../../ui';
import { formatSaudiDate } from '../../../utils/saudiDate';

const COL_LABEL_KEYS: Record<string, string> = {
  date: 'bankTplColDate',
  description: 'bankTplColDescription',
  notes: 'bankTplColNotes',
  debit: 'bankTplColDebit',
  credit: 'bankTplColCredit',
  balance: 'bankTplColBalance',
  reference: 'bankTplColReference',
  amount: 'bankTplColAmount',
};

function columnsToBadges(columnsJson: any, t: any) {
  if (!columnsJson || typeof columnsJson !== 'object') return [];
  return Object.entries(columnsJson)
    .filter(([, val]: any) => val && typeof val.index === 'number' && val.index >= 0)
    .map(([key, val]: any) => ({
      key,
      label: t(COL_LABEL_KEYS[key] || key),
      index: val.index,
    }));
}

export default function BankStatementTemplatesPanel({ companyId }: any) {
  const { t, lang } = useTranslation();
  const [deleteId, setDeleteId] = useState<any>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['bank-statement-templates', companyId],
    queryFn: async () => {
      const res = await bankStatementTemplatesList(companyId);
      throwIfApiFailed(res, res.error || 'فشل التحميل');
      return res.data ?? [];
    },
    enabled: !!companyId,
  });

  const toggleMut = useApiMutation({
    mutationFn: async ({ id, isActive }: any) => bankStatementTemplateSetActive(companyId, id, isActive),
    invalidateQueries: [['bank-statement-templates', companyId]],
    successToast: () => t('bankTemplatesUpdated'),
    errorToast: (e: any) => e?.message || t('apiRequestFailed'),
  });

  const deleteMut = useApiMutation({
    mutationFn: async (id: any) => bankStatementTemplateDelete(companyId, id),
    invalidateQueries: [['bank-statement-templates', companyId]],
    successToast: () => t('bankTemplatesDeleted'),
    errorToast: (e: any) => e?.message || t('apiRequestFailed'),
    onSuccess: () => { setDeleteId(null); },
  });

  const sorted = useMemo(() => [...list].sort((a: any, b: any) => (b.isActive === a.isActive ? 0 : a.isActive ? -1 : 1)), [list]);

  if (!companyId) return null;

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <div
        className="rounded-lg p-3.5 mb-4"
        style={{
          background: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
        }}
      >
        <div className="font-bold text-[15px] mb-1.5" style={{ color: 'var(--noorix-accent-blue)' }}>{t('bankTemplatesIntroTitle')}</div>
        <p className="m-0 text-[13px] leading-[1.5]" style={{ color: 'var(--noorix-accent-blue)' }}>{t('bankTemplatesIntroBody')}</p>
      </div>

      {isLoading ? <p className="text-noorix-muted">{t('loading')}…</p> : null}

      {!isLoading && !list.length ? (
        <div className="text-center text-noorix-muted p-6">
          <div className="mb-3 text-[20px] opacity-40"></div>
          <p className="m-0 font-semibold">{t('bankTemplatesEmptyTitle')}</p>
          <p className="text-[13px] m-0 mt-2">{t('bankTemplatesEmptySubtitle')}</p>
        </div>
      ) : null}

      <div className="grid gap-3">
        {sorted.map((tpl: any) => {
          const cols = columnsToBadges(tpl.columnsJson, t);
          const lastUsed = tpl.lastUsedAt ? formatSaudiDate(tpl.lastUsedAt) : null;
          return (
            <div
              key={tpl.id}
              className="noorix-surface-card p-4"
              style={{ opacity: tpl.isActive ? 1 : 0.6 }}
            >
                <div className="flex flex-wrap gap-3 justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex flex-wrap gap-2 mb-2.5">
                    <h3 className="m-0 text-[17px] font-extrabold">{tpl.bankName || t('bankTemplatesUnspecifiedBank')}</h3>
                    {tpl.customerName ? (
                      <span className="text-[11px] py-px px-2 rounded-md border border-noorix-border">{tpl.customerName}</span>
                    ) : null}
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 10px',
                        borderRadius: 6,
                        fontWeight: 700,
                        background: tpl.isActive ? 'var(--noorix-green-15)' : 'var(--noorix-red-12)',
                        color: tpl.isActive ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)',
                      }}
                    >
                      {tpl.isActive ? t('bankTemplatesStatusActive') : t('bankTemplatesStatusInactive')}
                    </span>
                  </div>
                  <div className="grid gap-2 text-[12px] text-noorix-muted mb-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
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
                    <div className="flex items-center flex flex-wrap gap-1.5">
                      <span className="text-[12px] text-noorix-muted">{t('bankTemplatesColumns')}:</span>
                      {cols.map((c: any) => (
                        <span
                          key={c.key}
                          className="text-[11px] py-px px-2 rounded-md bg-noorix-bg-muted border border-noorix-border"
                        >
                          {c.label}: {c.index}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
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
        variant="danger"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>{t('cancel')}</Button>
            <Button variant="danger" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteId)}>
              {deleteMut.isPending ? t('loading') : t('delete')}
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-noorix-muted">{t('bankTemplatesDeleteBody')}</p>
      </Modal>
    </div>
  );
}

