import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../ui';

type PipelineFailureStage = 'request' | 'parse' | null;

function statusBadgeClasses(status: 'pending' | 'running' | 'success' | 'failed' | 'warning') {
  if (status === 'success') return 'border-noorix-green bg-noorix-green text-white';
  if (status === 'failed') return 'border-noorix-red bg-noorix-red text-white';
  if (status === 'warning') return 'border-noorix-amber bg-noorix-amber text-white';
  if (status === 'running') return 'border-noorix-blue bg-noorix-blue text-white animate-pulse';
  return 'border-noorix-border bg-noorix-bg-muted text-noorix-muted';
}

function rowTextClasses(status: 'pending' | 'running' | 'success' | 'failed' | 'warning') {
  if (status === 'success') return 'text-noorix-green';
  if (status === 'failed') return 'text-noorix-red';
  if (status === 'warning') return 'text-noorix-amber';
  if (status === 'running') return 'text-noorix-blue';
  return 'text-noorix-muted';
}

export function OcrExtractionPipelineStatus({
  t,
  isAr,
  loading,
  extracted,
  extractWarning,
  extractError,
  extractFailureStage,
  extractStartedAt,
  onRetry,
}: {
  t: (k: string, ...args: any[]) => string;
  isAr: boolean;
  loading: boolean;
  extracted: any;
  extractWarning: any;
  extractError: any;
  extractFailureStage: PipelineFailureStage;
  extractStartedAt: number | null;
  onRetry: () => void;
}) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [loading]);

  const showPipeline = !!extractStartedAt || loading || !!extracted || !!extractFailureStage;
  const elapsedMs = extractStartedAt ? Math.max(0, tick - extractStartedAt) : 0;
  const activeStep = loading ? (elapsedMs < 1600 ? 1 : elapsedMs < 4200 ? 2 : 3) : null;

  const failAtStep = extractFailureStage === 'request' ? 1 : extractFailureStage === 'parse' ? 2 : null;
  const hasSuccess = !!extracted && !loading && !extractFailureStage;

  const steps = useMemo(
    () => [
      { key: 'upload-ready', label: t('ocrPipelineImageReady') },
      { key: 'model-request', label: t('ocrPipelineModelRequest') },
      { key: 'json-validate', label: t('ocrPipelineJsonValidation') },
      { key: 'enrich-match', label: t('ocrPipelineEnrichment') },
      { key: 'ready', label: t('ocrPipelineReadyForReview') },
    ],
    [t],
  );

  if (!showPipeline) return null;

  return (
    <div className="mt-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[12px] font-semibold text-noorix-text">{t('ocrPipelineTitle')}</div>
        {loading && <div className="text-[11px] text-noorix-blue">{t('ocrPipelineInProgress')}</div>}
      </div>

      <div className="flex flex-col gap-1.5">
        {steps.map((step, idx) => {
          let status: 'pending' | 'running' | 'success' | 'failed' | 'warning' = 'pending';
          if (hasSuccess) status = 'success';
          if (loading && activeStep != null) {
            if (idx < activeStep) status = 'success';
            if (idx === activeStep) status = 'running';
          } else if (failAtStep != null) {
            if (idx < failAtStep) status = 'success';
            else if (idx === failAtStep) status = 'failed';
          }
          if (hasSuccess && !!extractWarning && idx === 3) {
            status = 'warning';
          }
          return (
            <div key={step.key} className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border text-[10px] font-bold ${statusBadgeClasses(status)}`}
              >
                {status === 'success' ? '✓' : status === 'failed' ? '!' : idx + 1}
              </span>
              <span className={`text-[12px] ${rowTextClasses(status)}`}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {!!extractFailureStage && !loading && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="text-[12px] text-noorix-red">
            {extractFailureStage === 'request'
              ? t('ocrPipelineFailedAt', t('ocrPipelineModelRequest'))
              : t('ocrPipelineFailedAt', t('ocrPipelineJsonValidation'))}
          </div>
          <Button size="sm" variant="danger" onClick={onRetry}>
            {t('ocrRetryExtraction')}
          </Button>
        </div>
      )}

      {!!extractWarning && !loading && !extractFailureStage && (
        <div className="mt-2 text-[12px] text-noorix-amber">
          {isAr
            ? 'اكتمل الاستخراج مع تنبيه في المطابقة — راجع النتائج قبل الحفظ.'
            : 'Extraction completed with matching warning — review results before saving.'}
        </div>
      )}

      {!!extractError && !loading && !extractFailureStage && (
        <div className="mt-2 text-[12px] text-noorix-red">{String(extractError)}</div>
      )}
    </div>
  );
}
