import React from 'react';
import { Button } from '../../../ui';
import type { ImportEntityType } from '../types';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function TemplateDownloadPanel({
  entityType,
  lookupsLoading,
  onDownloadTemplate,
  t,
}: {
  entityType: ImportEntityType;
  lookupsLoading: boolean;
  onDownloadTemplate: () => void;
  t: TFn;
}) {
  return (
    <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
      <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2">{t('importStep1Title')}</p>
      <p className="m-0 text-[13px] text-noorix-muted leading-[1.6]">
        {t('importStep1Body')}
        {entityType === 'invoices' && t('importStep1HintInvoices')}
        {entityType === 'sales' && t('importStep1HintSales')}
        {entityType === 'employees' && t('importStep1HintEmployees')}
      </p>
      <Button onClick={onDownloadTemplate} disabled={lookupsLoading}>
        {lookupsLoading ? t('loading') : t('importDownloadTemplate')}
      </Button>
    </div>
  );
}
