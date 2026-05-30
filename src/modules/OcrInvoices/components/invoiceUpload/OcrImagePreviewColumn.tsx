import { Button } from '../../../../ui';
import { OcrExtractionPipelineStatus } from './OcrExtractionPipelineStatus';

export function OcrImagePreviewColumn({
  t,
  isAr,
  preview,
  submitterLabel = '',
  imageBase64,
  extracted,
  loading,
  saving,
  success,
  extractWarning,
  extractError,
  extractFailureStage,
  extractStartedAt,
  stageDurations,
  copyIssueText,
  issueCopied,
  stageArtifacts,
  copiedStageKey,
  copiedJsonKey,
  workflowMode = 'queue-submit',
  onResetAll,
  onExtract,
  onSave,
  onCopyIssue,
  onCopyStage,
  onCopyFinalJson,
  onCopyRawJson,
  onDownloadFinalJson,
  onDownloadRawJson,
}: any) {
  const isReview = workflowMode === 'review';
  const showPipeline = isReview && !!extracted;

  return (
    <div className="noorix-surface-card flex-[1_1_280px] min-w-0 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-[14px]">{isAr ? 'صورة الفاتورة' : 'Invoice Image'}</span>
        <Button className="modal-close-btn w-7 h-7" onClick={onResetAll}>
          ✕
        </Button>
      </div>
      <img src={preview} alt="invoice" className="w-full rounded-lg max-h-[500px] object-contain" />
      {!!String(submitterLabel || '').trim() && (
        <div
          className="mt-2 text-[12px] font-semibold text-noorix-text truncate"
          title={submitterLabel}
        >
          {isAr ? 'المرسل: ' : 'Submitted by: '}
          {submitterLabel}
        </div>
      )}
      <div className="mt-3 flex gap-2 flex flex-wrap">
        {!extracted && workflowMode === 'queue-submit' && (
          <Button onClick={onExtract} disabled={loading || !imageBase64} variant="primary" className="flex-1 min-w-0">
            {loading ? t('ocrSubmitting') : t('ocrSubmitForExtraction')}
          </Button>
        )}
        {extracted && isReview && (
          <>
            <Button onClick={onSave} disabled={saving || success} variant="primary" className="flex-1 min-w-0">
              {saving ? t('ocrSaving') : success ? t('ocrSaved') : t('ocrSaveInvoice')}
            </Button>
            <Button onClick={onExtract} disabled={loading} className="flex-1 min-w-0">
              {loading ? t('ocrRetrying') : t('ocrRetryExtraction')}
            </Button>
          </>
        )}
      </div>
      {showPipeline && (
        <OcrExtractionPipelineStatus
          t={t}
          isAr={isAr}
          loading={loading}
          extracted={extracted}
          extractWarning={extractWarning}
          extractError={extractError}
          extractFailureStage={extractFailureStage}
          extractStartedAt={extractStartedAt}
          stageDurations={stageDurations}
          copyIssueText={copyIssueText}
          issueCopied={issueCopied}
          stageArtifacts={stageArtifacts}
          copiedStageKey={copiedStageKey}
          copiedJsonKey={copiedJsonKey}
          onRetry={onExtract}
          onCopyIssue={onCopyIssue}
          onCopyStage={onCopyStage}
          onCopyFinalJson={onCopyFinalJson}
          onCopyRawJson={onCopyRawJson}
          onDownloadFinalJson={onDownloadFinalJson}
          onDownloadRawJson={onDownloadRawJson}
        />
      )}
    </div>
  );
}
