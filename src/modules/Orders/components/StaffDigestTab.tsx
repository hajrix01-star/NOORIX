/**
 * StaffDigestTab — تبويب الكاشير/المدير لمراجعة طلبات الأقسام وإرسالها
 * يُعرض فقط لمن لديه صلاحية STAFF_ORDERS_DIGEST
 */
import React, { useState, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { digestSectionsTotal, formatVariantLabel } from '../utils/staffOrderBasketUtils';
import { useStaffDigest, useSendStaffDigestMutation } from '../../../hooks/useOrders';
import { Button, Badge, Spinner, ScreenTabs } from '../../../ui';
import { StaffDigestHistoryTab } from './StaffDigestHistoryTab';
import { StaffDigestSendModal } from './StaffDigestSendModal';
import type { StaffDigestOrderItem, StaffDigestSection } from '../../../types/api';

type DisplayLang = 'ar' | 'en';

function lineAmount(it: StaffDigestOrderItem): Decimal {
  return new Decimal(it.quantity || 0).times(it.unitPrice ?? 0);
}

function SectionCard({
  section,
  displayLang,
  onSendSection,
}: {
  section: StaffDigestSection;
  displayLang: DisplayLang;
  onSendSection: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const orderIds = section.orders.map((o) => o.id);

  function itemName(it: StaffDigestOrderItem): string {
    return displayLang === 'en'
      ? (it.product?.nameEn || it.product?.nameAr || '—')
      : (it.product?.nameAr || it.product?.nameEn || '—');
  }

  return (
    <div className="noorix-surface-card overflow-hidden">
      <Button
        type="button"
        variant="raw"
        size="auto"
        className="w-full flex items-center justify-between px-4 py-3 border-b border-noorix-border hover:bg-noorix-bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold">{section.sectionName}</span>
          <Badge color="amber" size="sm">{section.totalItems} {t('staffOrderItemsCount')}</Badge>
        </div>
        <span className="text-noorix-muted text-[13px]">{expanded ? '▲' : '▼'}</span>
      </Button>

      {expanded && (
        <div className="divide-y divide-noorix-border">
          {section.orders.map((order) => (
            <div key={order.id} className="px-4 py-3">
              <div className="text-[12px] text-noorix-muted mb-2">
                {order.user?.nameAr || order.user?.nameEn || '—'} · {formatSaudiDate(order.createdAt ?? '')}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {(order.items || []).map((it, i) => {
                  const variant = formatVariantLabel(it.size, it.packaging, it.unit);
                  const amt = lineAmount(it);
                  return (
                    <div key={i} className="flex justify-between gap-2 text-[13px]">
                      <div className="min-w-0">
                        <span>{itemName(it)}</span>
                        {variant ? <div className="text-[10px] text-noorix-muted ltr">{variant}</div> : null}
                      </div>
                      <span className="font-bold nx-font-numbers shrink-0 ltr text-end">
                        {fmt(it.quantity, 0)}
                        {Number(it.unitPrice) > 0 ? (
                          <> × {fmt(it.unitPrice)} = {fmt(amt.toNumber())} <span className="nx-sar">SR</span></>
                        ) : (
                          it.unit ? ` ${it.unit}` : ''
                        )}
                      </span>
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
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { data: digest, isLoading, refetch } = useStaffDigest(companyId);
  const sendDigest = useSendStaffDigestMutation(companyId);
  const [sending, setSending] = useState(false);
  const [displayLang, setDisplayLang] = useState<DisplayLang>(lang as DisplayLang);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [pendingOrderIds, setPendingOrderIds] = useState<string[] | undefined>(undefined);

  const tabs = useMemo(() => [
    { id: 'pending', label: t('staffDigestPending') },
    { id: 'history', label: t('digestHistoryTitle') },
  ], [t]);

  const sections: StaffDigestSection[] = digest?.sections ?? [];
  const pendingCount: number = digest?.pendingCount ?? 0;
  const estimatedTotal = useMemo(() => digestSectionsTotal(sections), [sections]);
  const modalEstimatedTotal = useMemo(() => {
    if (!pendingOrderIds?.length) return estimatedTotal;
    const idSet = new Set(pendingOrderIds);
    const filtered = sections.map((sec) => ({
      ...sec,
      orders: sec.orders.filter((o) => idSet.has(o.id)),
    })).filter((sec) => sec.orders.length > 0);
    return digestSectionsTotal(filtered);
  }, [sections, pendingOrderIds, estimatedTotal]);
  const modalPendingCount = pendingOrderIds?.length ?? pendingCount;

  const runSend = useCallback(async (
    orderIds: string[] | undefined,
    opts: { orderType: 'external' | 'internal'; pettyCashAmount?: string; orderDate: string },
  ) => {
    setSending(true);
    try {
      const res = await sendDigest.mutateAsync({
        orderIds,
        lang: displayLang,
        orderType: opts.orderType,
        pettyCashAmount: opts.pettyCashAmount,
        orderDate: opts.orderDate,
      });
      const whatsAppText = res.data?.whatsAppText ?? '';
      if (whatsAppText) {
        window.open(`https://wa.me/?text=${encodeURIComponent(whatsAppText)}`, '_blank', 'noopener,noreferrer');
      }
      const po = res.data?.purchaseOrder;
      if (po?.orderNumber) {
        showToast(t('staffDigestCreatedOrder', po.orderNumber), 'success');
      } else {
        showToast(t('staffDigestSent'), 'success');
      }
      setSendModalOpen(false);
      setPendingOrderIds(undefined);
      refetch();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSending(false);
    }
  }, [sendDigest, refetch, displayLang, t, showToast]);

  const openSendModal = useCallback((orderIds?: string[]) => {
    if (!pendingCount && !orderIds?.length) return;
    setPendingOrderIds(orderIds);
    setSendModalOpen(true);
  }, [pendingCount]);

  return (
    <ScreenTabs
      items={tabs}
      value={activeTab}
      onChange={(v) => setActiveTab(v as 'pending' | 'history')}
    >
      {activeTab === 'pending' && (
        <div className="flex flex-col gap-4">
          <div className="noorix-surface-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <Badge color="amber" size="sm">{pendingCount} {t('staffOrdersCount')}</Badge>
              {estimatedTotal > 0 ? (
                <span className="text-[12px] text-noorix-muted">
                  {t('staffDigestEstimatedTotal')}:{' '}
                  <span className="font-bold text-noorix-green ltr">{fmt(estimatedTotal)} <span className="nx-sar">SR</span></span>
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-noorix-border overflow-hidden text-[12px]">
                <Button
                  type="button"
                  variant="raw"
                  size="auto"
                  className={`px-3 py-1.5 transition-colors ${displayLang === 'ar' ? 'bg-noorix-blue text-white font-bold' : 'bg-noorix-surface text-noorix-muted hover:bg-noorix-bg-muted'}`}
                  onClick={() => setDisplayLang('ar')}
                >
                  AR
                </Button>
                <Button
                  type="button"
                  variant="raw"
                  size="auto"
                  className={`px-3 py-1.5 transition-colors ${displayLang === 'en' ? 'bg-noorix-blue text-white font-bold' : 'bg-noorix-surface text-noorix-muted hover:bg-noorix-bg-muted'}`}
                  onClick={() => setDisplayLang('en')}
                >
                  EN
                </Button>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openSendModal()}
                disabled={sending || !pendingCount}
              >
                {sending ? t('sending') : t('staffDigestSendAll')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : sections.length === 0 ? (
            <div className="noorix-surface-card p-10 text-center text-noorix-muted text-[14px]">
              {t('staffDigestEmpty')}
            </div>
          ) : (
            sections.map((sec: StaffDigestSection) => (
              <SectionCard
                key={sec.sectionName}
                section={sec}
                displayLang={displayLang}
                onSendSection={(ids) => openSendModal(ids)}
              />
            ))
          )}

          <StaffDigestSendModal
            open={sendModalOpen}
            onClose={() => { setSendModalOpen(false); setPendingOrderIds(undefined); }}
            estimatedTotal={modalEstimatedTotal}
            pendingCount={modalPendingCount}
            busy={sending}
            onConfirm={(opts) => runSend(pendingOrderIds, opts)}
          />
        </div>
      )}

      {activeTab === 'history' && <StaffDigestHistoryTab companyId={companyId} />}
    </ScreenTabs>
  );
}
