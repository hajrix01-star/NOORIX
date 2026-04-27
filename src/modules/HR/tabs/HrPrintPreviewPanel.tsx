import React from 'react';
import { Button } from '../../../ui';
import type { HrPrintComposeResult } from './hrPrintDocumentsTabPrintHtml';

type Translate = (key: string) => string;

export function HrPrintPreviewPanel({
  t,
  composed,
  previewSrcDoc,
  onPrint,
  hasEmployee,
}: {
  t: Translate;
  composed: HrPrintComposeResult;
  previewSrcDoc: string;
  onPrint: () => void;
  hasEmployee: boolean;
}) {
  return (
    <aside className="min-w-0 space-y-3 rounded-xl border border-noorix-border bg-noorix-bg-muted/25 p-3 xl:sticky xl:top-4 xl:self-start">
      <p className="m-0 text-[13px] font-semibold text-noorix-text">{t('hrPrintPreview')}</p>
      <p className="m-0 text-[11px] leading-relaxed text-noorix-muted">{t('hrPrintPreviewNote')}</p>
      {composed.err === 'annual_empty' ? (
        <p className="m-0 rounded-lg border border-dashed border-noorix-border bg-noorix-bg-muted/50 p-4 text-center text-[12px] text-noorix-muted">
          {t('hrPrintPreviewEmpty')}
        </p>
      ) : (
        <iframe
          title={t('hrPrintPreview')}
          className="h-[min(72vh,560px)] w-full rounded-lg border border-noorix-border bg-white shadow-sm"
          srcDoc={previewSrcDoc}
          sandbox="allow-same-origin"
        />
      )}
      <Button type="button" size="sm" variant="primary" className="w-full" disabled={!hasEmployee || !composed.inner} onClick={onPrint}>
        {t('print')}
      </Button>
    </aside>
  );
}
