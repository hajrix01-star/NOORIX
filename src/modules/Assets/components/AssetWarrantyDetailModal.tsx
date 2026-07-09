import React, { useEffect, useState } from 'react';
import { AdaptiveSheet, Badge, Button } from '../../../ui';
import {
  getCompanyAsset,
  getCompanyAssetWarrantyAttachmentObjectUrl,
  throwIfApiFailed,
} from '../../../services/api';
import {
  formatAssetDate,
  formatWarrantyDuration,
  getSupplierDisplayName,
} from '../utils/assetsRegisterMappers';
import { normalizeWarrantyStatus } from '../assetsRegisterModel';
import { useWarrantyBadgeMap } from '../utils/assetsRegisterCalculations';
import type { AssetRegisterListItem } from '../types';

export type AssetWarrantyDetailModalProps = {
  asset: AssetRegisterListItem;
  companyId: string;
  onClose: () => void;
  t: (key: string) => string;
  lang: string;
};

export function AssetWarrantyDetailModal({
  asset,
  companyId,
  onClose,
  t,
  lang,
}: AssetWarrantyDetailModalProps) {
  const [detail, setDetail] = useState<AssetRegisterListItem>(asset);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const warrantyBadgeMap = useWarrantyBadgeMap(t);
  const status = normalizeWarrantyStatus(detail.warrantyStatus);
  const badge = warrantyBadgeMap[status] ?? warrantyBadgeMap.none;
  const supplierName = getSupplierDisplayName(detail.supplier, lang);
  const invoiceRef = detail.invoice?.supplierInvoiceNumber || detail.invoice?.invoiceNumber || '';

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const res = await getCompanyAsset(asset.id, companyId);
        throwIfApiFailed(res, t('loadingError'));
        if (!active || !res.data) return;
        setDetail(res.data);
        if (res.data.hasWarrantyAttachment) {
          objectUrl = await getCompanyAssetWarrantyAttachmentObjectUrl(asset.id, companyId);
          if (active) setImageUrl(objectUrl);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : t('loadingError'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.id, companyId, t]);

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={t('assetWarrantyDetails')}
      size="md"
      footer={<Button onClick={onClose}>{t('close')}</Button>}
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold text-noorix-text">{detail.nameAr}</div>
              {detail.nameEn ? (
                <div className="truncate text-[12px] text-noorix-muted">{detail.nameEn}</div>
              ) : null}
            </div>
            <Badge color={badge.color} size="sm">{badge.label}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2">
              <div className="text-[11px] font-semibold text-noorix-muted">{t('assetWarrantyDuration')}</div>
              <div className="mt-1 text-[14px] font-bold text-noorix-text">{formatWarrantyDuration(detail.warrantyMonths, lang)}</div>
            </div>
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2">
              <div className="text-[11px] font-semibold text-noorix-muted">{t('assetWarrantyStart')}</div>
              <div className="mt-1 text-[13px] font-bold text-noorix-text ltr">{formatAssetDate(detail.warrantyStartDate)}</div>
            </div>
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2">
              <div className="text-[11px] font-semibold text-noorix-muted">{t('assetWarrantyEnd')}</div>
              <div className="mt-1 text-[13px] font-bold text-noorix-text ltr">{formatAssetDate(detail.warrantyEndDate)}</div>
            </div>
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2">
              <div className="text-[11px] font-semibold text-noorix-muted">{t('assetDaysToEnd')}</div>
              <div className="mt-1 text-[14px] font-bold text-noorix-text ltr">{detail.daysToWarrantyEnd ?? '-'}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2">
              <div className="text-[11px] font-semibold text-noorix-muted">{t('assetSupplier')}</div>
              <div className="mt-1 truncate text-[13px] font-bold text-noorix-text" title={supplierName}>{supplierName}</div>
            </div>
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2">
              <div className="text-[11px] font-semibold text-noorix-muted">{t('invoiceNumber')}</div>
              <div className="mt-1 truncate text-[13px] font-bold text-noorix-text ltr" title={String(invoiceRef || '-')}>{invoiceRef || '-'}</div>
            </div>
            <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2">
              <div className="text-[11px] font-semibold text-noorix-muted">{t('assetSerial')}</div>
              <div className="mt-1 truncate text-[13px] font-bold text-noorix-text ltr" title={String(detail.serialNumber || '-')}>{detail.serialNumber || '-'}</div>
            </div>
          </div>
        </div>

        {detail.warrantyDescription ? (
          <div className="rounded-lg border border-noorix-border bg-noorix-surface p-3 text-[13px] text-noorix-text">
            <div className="mb-1 text-[12px] font-semibold text-noorix-muted">{t('assetWarrantyDescription')}</div>
            {detail.warrantyDescription}
          </div>
        ) : null}

        <div className="rounded-lg border border-noorix-border bg-noorix-surface p-3">
          <div className="mb-2 text-[12px] font-semibold text-noorix-muted">{t('assetWarrantyAttachment')}</div>
          {loading ? <div className="text-[13px] text-noorix-muted">{t('loading')}</div> : null}
          {error ? <div className="text-[13px] text-noorix-red">{error}</div> : null}
          {!loading && !error && imageUrl ? (
            <img
              src={imageUrl}
              alt={detail.warrantyAttachmentOriginalName || t('assetWarrantyAttachment')}
              className="max-h-[360px] w-full rounded-lg border border-noorix-border object-contain"
            />
          ) : null}
          {!loading && !error && !imageUrl ? (
            <div className="text-[13px] text-noorix-muted">{t('assetWarrantyNoAttachment')}</div>
          ) : null}
        </div>

        {detail.warrantyLines?.length ? (
          <div className="rounded-lg border border-noorix-border bg-noorix-surface p-3">
            <div className="mb-2 text-[12px] font-semibold text-noorix-muted">{t('warrantyLinesOptionalTitle')}</div>
            <div className="flex flex-col gap-2">
              {detail.warrantyLines.map((line) => (
                <div key={line.id ?? line.nameAr} className="rounded-md bg-noorix-bg-muted px-3 py-2 text-[12px]">
                  <div className="font-semibold text-noorix-text">{line.nameAr}</div>
                  {line.notes ? <div className="text-noorix-muted">{line.notes}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AdaptiveSheet>
  );
}
