import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../ui';

type PipelineFailureStage = 'request' | 'parse' | null;
type PipelineStageDurations = {
  uploadReadyMs?: number | null;
  modelRequestMs?: number | null;
  jsonValidationMs?: number | null;
  enrichmentMs?: number | null;
  readyForReviewMs?: number | null;
};
type StageArtifactRow = { status?: string; reportText?: string };

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
  reviewInvoiceStatus = null,
  stageDurations,
  copyIssueText,
  issueCopied,
  stageArtifacts,
  copiedStageKey,
  copiedJsonKey,
  onRetry,
  onCopyIssue,
  onCopyStage,
  onCopyFinalJson,
  onCopyRawJson,
  onDownloadFinalJson,
  onDownloadRawJson,
}: {
  t: (k: string, ...args: any[]) => string;
  isAr: boolean;
  loading: boolean;
  extracted: any;
  extractWarning: any;
  extractError: any;
  extractFailureStage: PipelineFailureStage;
  extractStartedAt: number | null;
  reviewInvoiceStatus?: string | null;
  stageDurations?: PipelineStageDurations;
  copyIssueText?: string;
  issueCopied?: boolean;
  stageArtifacts?: Record<string, StageArtifactRow> | null;
  copiedStageKey?: string | null;
  copiedJsonKey?: string | null;
  onRetry: () => void;
  onCopyIssue?: () => void;
  onCopyStage?: (stageKey: string) => void;
  onCopyFinalJson?: () => void;
  onCopyRawJson?: () => void;
  onDownloadFinalJson?: () => void;
  onDownloadRawJson?: () => void;
}) {
  const [tick, setTick] = useState(() => Date.now());
  const isQueued = reviewInvoiceStatus === 'queued';
  const isServerExtracting = reviewInvoiceStatus === 'extracting';
  const isServerFailed = reviewInvoiceStatus === 'extraction_failed';
  const effectiveLoading = loading || isServerExtracting;

  useEffect(() => {
    if (!effectiveLoading) return;
    const id = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [effectiveLoading]);

  const showPipeline =
    !!extractStartedAt ||
    effectiveLoading ||
    !!extracted ||
    !!extractFailureStage ||
    isQueued ||
    isServerFailed;
  const elapsedMs = extractStartedAt ? Math.max(0, tick - extractStartedAt) : 0;
  const activeStep = effectiveLoading ? (elapsedMs < 1600 ? 1 : elapsedMs < 4200 ? 2 : 3) : null;

  const failAtStep =
    extractFailureStage === 'request' ? 1 : extractFailureStage === 'parse' ? 2 : isServerFailed ? 1 : null;
  const hasSuccess = !!extracted && !effectiveLoading && !extractFailureStage && !isServerFailed;

  const steps = useMemo(
    () => [
      { key: 'upload-ready', artifactKey: 'uploadReady', label: t('ocrPipelineImageReady') },
      { key: 'model-request', artifactKey: 'modelRequest', label: t('ocrPipelineModelRequest') },
      { key: 'json-validate', artifactKey: 'jsonValidation', label: t('ocrPipelineJsonValidation') },
      { key: 'enrich-match', artifactKey: 'enrichment', label: t('ocrPipelineEnrichment') },
      { key: 'ready', artifactKey: 'readyForReview', label: t('ocrPipelineReadyForReview') },
    ],
    [t],
  );
  const completedTimes = [
    stageDurations?.uploadReadyMs ?? null,
    stageDurations?.modelRequestMs ?? null,
    stageDurations?.jsonValidationMs ?? null,
    stageDurations?.enrichmentMs ?? null,
    stageDurations?.readyForReviewMs ?? null,
  ];

  if (!showPipeline) return null;

  const stageRunningElapsed = (idx: number) => {
    if (!effectiveLoading) return 0;
    if (idx === 0) return Math.max(0, Math.min(elapsedMs, 1600));
    if (idx === 1) return Math.max(0, Math.min(elapsedMs - 1600, 2600));
    if (idx === 2) return Math.max(0, elapsedMs - 4200);
    return 0;
  };

  const formatMs = (ms: number) => `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s`;

  return (
    <div className="mt-3 rounded-lg border border-noorix-border bg-noorix-bg-muted/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[12px] font-semibold text-noorix-text">{t('ocrPipelineTitle')}</div>
        {isQueued && <div className="text-[11px] text-noorix-muted">{t('ocrQueueWaiting')}</div>}
        {effectiveLoading && !isQueued && (
          <div className="text-[11px] text-noorix-blue">{t('ocrPipelineInProgress')}</div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {steps.map((step, idx) => {
          let status: 'pending' | 'running' | 'success' | 'failed' | 'warning' = 'pending';
          if (hasSuccess) status = 'success';
          if (isQueued) {
            status = idx === 0 ? 'success' : 'pending';
          } else if (effectiveLoading && activeStep != null) {
            if (idx < activeStep) status = 'success';
            if (idx === activeStep) status = 'running';
            if (idx === 0 && activeStep >= 1) status = 'success';
          } else if (failAtStep != null) {
            if (idx < failAtStep) status = 'success';
            else if (idx === failAtStep) status = 'failed';
          }
          if (hasSuccess && !!extractWarning && idx === 3) {
            status = 'warning';
          }
          return (
            <div key={step.key} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border text-[10px] font-bold ${statusBadgeClasses(status)}`}
                >
                  {status === 'success' ? '✓' : status === 'failed' ? '!' : idx + 1}
                </span>
                <span className={`text-[12px] ${rowTextClasses(status)}`}>{step.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[11px] font-medium ${rowTextClasses(status)}`}
                >
                  {completedTimes[idx] != null
                    ? formatMs(Number(completedTimes[idx]))
                    : effectiveLoading && status === 'running'
                      ? formatMs(stageRunningElapsed(idx))
                      : isQueued && idx === 0
                        ? '✓'
                        : '—'}
                </span>
                {!!stageArtifacts?.[step.artifactKey]?.reportText && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCopyStage?.(step.artifactKey)}
                  >
                    {t('ocrPipelineCopyStage')}
                  </Button>
                )}
                {copiedStageKey === step.artifactKey && (
                  <span className="text-[11px] text-noorix-green">{t('ocrPipelineIssueCopied')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!!(extracted || stageArtifacts) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onCopyFinalJson}>
            {t('ocrPipelineCopyFinalJson')}
          </Button>
          {copiedJsonKey === 'final' && <span className="text-[11px] text-noorix-green">{t('ocrPipelineIssueCopied')}</span>}
          <Button size="sm" variant="ghost" onClick={onCopyRawJson}>
            {t('ocrPipelineCopyRawJson')}
          </Button>
          {copiedJsonKey === 'raw' && <span className="text-[11px] text-noorix-green">{t('ocrPipelineIssueCopied')}</span>}
          <Button size="sm" variant="ghost" onClick={onDownloadFinalJson}>
            {t('ocrPipelineDownloadFinalJson')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDownloadRawJson}>
            {t('ocrPipelineDownloadRawJson')}
          </Button>
        </div>
      )}

      {!!(extractFailureStage || isServerFailed) && !effectiveLoading && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="text-[12px] text-noorix-red">
            {extractFailureStage === 'parse'
              ? t('ocrPipelineFailedAt', t('ocrPipelineJsonValidation'))
              : t('ocrPipelineFailedAt', t('ocrPipelineModelRequest'))}
          </div>
          <Button size="sm" variant="danger" onClick={onRetry}>
            {t('ocrRetryExtraction')}
          </Button>
          {!!copyIssueText && (
            <Button size="sm" variant="ghost" onClick={onCopyIssue}>
              {t('ocrPipelineCopyIssue')}
            </Button>
          )}
          {issueCopied && <span className="text-[11px] text-noorix-green">{t('ocrPipelineIssueCopied')}</span>}
        </div>
      )}

      {!!extractWarning && !effectiveLoading && !extractFailureStage && !isServerFailed && (
        <div className="mt-2 text-[12px] text-noorix-amber">
          {isAr
            ? 'اكتمل الاستخراج مع تنبيه في المطابقة — راجع النتائج قبل الحفظ.'
            : 'Extraction completed with matching warning — review results before saving.'}
        </div>
      )}

      {!!extractError && !effectiveLoading && !extractFailureStage && (
        <div className="mt-2 text-[12px] text-noorix-red">{String(extractError)}</div>
      )}
    </div>
  );
}
