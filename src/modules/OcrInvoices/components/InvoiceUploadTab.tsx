import React from 'react';
import { useInvoiceUploadTab } from './useInvoiceUploadTab';
import { ocrSubmitterLabel } from '../utils/ocrSubmitterLabel';
import {
  OcrUploadPrefillBanner,
  OcrPrefillLinkedPurchaseBanner,
  OcrPostSaveLinkedBanner,
  OcrEmptyImageDropzone,
  OcrErrorBanner,
  OcrWarningBanner,
} from './invoiceUpload/OcrUploadBannersAndDropzone';
import { OcrImagePreviewColumn } from './invoiceUpload/OcrImagePreviewColumn';
import { OcrExtractedInfoAndTotalsCard } from './invoiceUpload/OcrExtractedInfoAndTotalsCard';
import { OcrLinkedPurchaseForm } from './invoiceUpload/OcrLinkedPurchaseForm';
import { OcrLineItemsList, OcrWarningStrip } from './invoiceUpload/OcrLineItemsAndWarnings';
import { OcrNewSupplierModal } from './invoiceUpload/OcrNewSupplierModal';
import OcrBatchUploadPanel from './OcrBatchUploadPanel';

export default function InvoiceUploadTab(props: any) {
  const o = useInvoiceUploadTab(props);
  const isQueueSubmit = o.workflowMode === 'queue-submit';

  const submitterCaption = ocrSubmitterLabel(o.prefillSubmittedBy, o.isAr);

  return (
    <div className="flex flex-col gap-5" dir={o.dir}>
      {isQueueSubmit && !o.preview && (
        <p className="text-[13px] text-noorix-muted m-0">{o.t('ocrUploadPageHint')}</p>
      )}
      {isQueueSubmit && o.submittedId && (
        <div className="rounded-lg border border-noorix-accent-green/40 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-[13px] text-noorix-text">
          {o.t('ocrSubmitSentOk', o.submittedId)}
        </div>
      )}
      <OcrUploadPrefillBanner t={o.t} prefillLoading={o.prefillLoading} />
      <OcrPrefillLinkedPurchaseBanner t={o.t} prefillLinkedPurchase={o.prefillLinkedPurchase} />
      <OcrPostSaveLinkedBanner
        t={o.t}
        success={o.success}
        postSaveLinkedPurchase={o.postSaveLinkedPurchase}
      />

      {!o.preview && isQueueSubmit && (
        <OcrBatchUploadPanel disabled={!o.activeCompanyId} companyId={o.activeCompanyId} />
      )}

      {!o.preview && !isQueueSubmit && (
        <OcrEmptyImageDropzone
          t={o.t}
          dragging={o.dragging}
          onDragOver={() => o.setDragging(true)}
          onDragLeave={() => o.setDragging(false)}
          onDrop={o.handleDrop}
          onClickPick={() => { o.fileRef.current?.click(); }}
          fileRef={o.fileRef}
          onFileInputChange={o.readFile}
        />
      )}

      {o.preview && (
        <div className="flex flex flex-wrap gap-[18px] items-start">
          <OcrImagePreviewColumn
            t={o.t}
            isAr={o.isAr}
            preview={o.preview}
            submitterLabel={submitterCaption}
            imageBase64={o.imageBase64}
            extracted={o.extracted}
            loading={o.loading}
            saving={o.saving}
            success={o.success}
            extractWarning={o.extractWarning}
            extractError={o.error}
            extractFailureStage={o.extractFailureStage}
            extractStartedAt={o.extractStartedAt}
            stageDurations={o.extractStageDurations}
            copyIssueText={o.extractIssueReport}
            issueCopied={o.issueCopied}
            stageArtifacts={o.extractStageArtifacts}
            copiedStageKey={o.copiedStageKey}
            copiedJsonKey={o.copiedJsonKey}
            reviewInvoiceStatus={o.reviewInvoiceStatus}
            workflowMode={o.workflowMode}
            onResetAll={o.handleResetImageColumn}
            onExtract={o.handleExtract}
            onCopyIssue={o.handleCopyIssueReport}
            onCopyStage={o.handleCopyStageArtifact}
            onCopyFinalJson={o.handleCopyFinalJson}
            onCopyRawJson={o.handleCopyRawJson}
            onDownloadFinalJson={o.handleDownloadFinalJson}
            onDownloadRawJson={o.handleDownloadRawJson}
            onSave={o.handleSave}
          />

          {o.extracted && (
            <div className="flex flex-col gap-[14px] flex-[1_1_280px] min-w-0">
              <OcrExtractedInfoAndTotalsCard
                t={o.t}
                extracted={o.extracted}
                isAr={o.isAr}
                suppliers={o.suppliers}
                onSupplierMatchChange={o.handleSupplierMatchChange}
              />
              <OcrLinkedPurchaseForm
                t={o.t}
                finalizeOcrId={o.finalizeOcrId}
                canCreatePurchase={o.canCreatePurchase}
                accSuggestions={o.accSuggestions}
                accSuggestionsFetching={o.accSuggestionsFetching}
                accountingSupplierId={o.accountingSupplierId}
                onAccountingSupplierIdChange={o.onAccountingSupplierIdChange}
                onOpenNewOcrSupplier={o.openNewOcrSupplierModal}
                prefillOcrSupplierId={o.prefillOcrSupplierId}
                prefillLoading={o.prefillLoading}
                supplierNameForSuggest={o.supplierNameForSuggest}
                invoiceVatDigits={o.invoiceVatDigits}
                createLinkedPurchase={o.createLinkedPurchase}
                onCreateLinkedPurchaseChange={o.setCreateLinkedPurchase}
                transactionDate={o.transactionDate}
                onTransactionDateChange={o.setTransactionDate}
                vaultId={o.vaultId}
                onVaultIdChange={o.setVaultId}
                vaultRows={o.vaultRows}
                purchaseSupplierInvoiceNumber={o.purchaseSupplierInvoiceNumber}
                onPurchaseSupplierInvoiceNumberChange={o.setPurchaseSupplierInvoiceNumber}
                extracted={o.extracted}
                isPurchaseTaxable={o.isPurchaseTaxable}
                onIsPurchaseTaxableChange={o.setIsPurchaseTaxable}
                lang={o.language}
              />
              <OcrWarningStrip warningCount={o.warningCount} extracted={o.extracted} isAr={o.isAr} />
              <OcrLineItemsList
                t={o.t}
                language={o.language}
                activeItems={o.activeItems}
                lineTaxMode={o.extracted?.lineTaxMode}
                itemCatalog={o.items}
                onUpdateItem={o.updateItem}
                onApplySuggestion={o.applyMathSuggestion}
                onItemMatchChange={o.handleItemMatchChange}
              />
            </div>
          )}
        </div>
      )}

      <OcrErrorBanner error={o.error} />
      <OcrWarningBanner warning={o.extractWarning} />
      <OcrNewSupplierModal
        t={o.t}
        open={o.newOcrSupplierOpen}
        dir={o.dir}
        isSaving={o.newOcrSaving}
        nameAr={o.newOcrNameAr}
        onNameArChange={o.setNewOcrNameAr}
        tax={o.newOcrTax}
        onTaxChange={o.setNewOcrTax}
        error={o.newOcrError}
        onClose={() => o.setNewOcrSupplierOpen(false)}
        onSubmit={o.handleSubmitNewOcrSupplier}
      />
    </div>
  );
}
