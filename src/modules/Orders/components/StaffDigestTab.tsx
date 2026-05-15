/**
 * StaffDigestTab — تبويب الكاشير/المدير لمراجعة طلبات الأقسام وإرسالها
 * يُعرض فقط لمن لديه صلاحية STAFF_ORDERS_DIGEST
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { useStaffDigest, useSendStaffDigestMutation } from '../../../hooks/useOrders';
import { Button, Badge, Spinner } from '../../../ui';

function SectionCard({ section, onSendSection }: { section: any; onSendSection: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const orderIds = section.orders.map((o: any) => o.id);

  return (
    <div className="noorix-surface-card overflow-hidden">
      {/* رأس القسم */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 border-b border-noorix-border hover:bg-noorix-bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold">{section.sectionName}</span>
          <Badge color="amber" size="sm">{section.totalItems} {t('staffOrderItemsCount')}</Badge>
        </div>
        <span className="text-noorix-muted text-[13px]">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-noorix-border">
          {section.orders.map((order: any) => (
            <div key={order.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] text-noorix-muted">
                  {order.user?.nameAr || order.user?.nameEn || '—'} · {formatSaudiDate(order.createdAt)}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {(order.items || []).map((it: any, i: number) => {
                  const name = it.product?.nameAr || it.product?.nameEn || '—';
                  const unit = it.unit ? ` ${it.unit}` : '';
                  return (
                    <div key={i} className="flex justify-between text-[13px]">
                      <span>{name}</span>
                      <span className="font-bold nx-font-numbers">{fmt(it.quantity, 0)}{unit}</span>
                    </div>
                  );
                })}
              </div>
              {order.notes && (
                <div className="mt-1 text-[11px] text-noorix-muted italic">{order.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* زر إرسال القسم */}
      {section.orders.length > 0 && (
        <div className="px-4 py-3 border-t border-noorix-border bg-noorix-bg-muted/30">
          <Button size="sm" variant="ghost" onClick={() => onSendSection(orderIds)}>
            {t('staffDigestSendSection', section.sectionName)}
          </Button>
        </div>
      )}
    </div>
  );
}

export function StaffDigestTab({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { data: digest, isLoading, refetch } = useStaffDigest(companyId);
  const sendDigest = useSendStaffDigestMutation(companyId);
  const [sending, setSending] = useState(false);

  const sections: any[] = digest?.sections ?? [];
  const pendingCount: number = digest?.pendingCount ?? 0;

  const handleSend = useCallback(async (orderIds?: string[]) => {
    if (!pendingCount && !orderIds?.length) return;
    setSending(true);
    try {
      const res = await sendDigest.mutateAsync(orderIds);
      const whatsAppText: string = (res as any)?.data?.whatsAppText || (res as any)?.whatsAppText || '';
      if (whatsAppText) {
        window.open(`https://wa.me/?text=${encodeURIComponent(whatsAppText)}`, '_blank');
      }
      showToast(t('staffDigestSent'), 'success');
      refetch();
    } catch (e: any) {
      showToast(e?.message || t('saveFailed'), 'error');
    } finally {
      setSending(false);
    }
  }, [pendingCount, sendDigest, refetch]);

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <Spinner />
    </div>
  );

  if (sections.length === 0) return (
    <div className="noorix-surface-card p-10 text-center text-noorix-muted text-[14px]">
      {t('staffDigestEmpty')}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* شريط الإجراءات */}
      <div className="noorix-surface-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold">{t('staffDigestPending')}</span>
          <Badge color="amber" size="sm">{pendingCount} {t('staffOrdersCount')}</Badge>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleSend()}
          disabled={sending || !pendingCount}
        >
          {sending ? t('sending') : t('staffDigestSendAll')}
        </Button>
      </div>

      {/* بطاقات الأقسام */}
      {sections.map((sec: any) => (
        <SectionCard
          key={sec.sectionName}
          section={sec}
          onSendSection={(ids) => handleSend(ids)}
        />
      ))}
    </div>
  );
}
