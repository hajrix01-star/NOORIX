import React, { useState, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { bankStatementUpload } from '../../services/api';
import { Button, AdaptiveSheet, FileTrigger } from '../../ui';
import type { BankSheetData } from './bank/bankMappingAutoDetect';
import type { BankStatementLite } from './bank/bankAnalysisTab.types';

const STEPS = [
  { id: 'upload', labelKey: 'bankStatementStepUpload' },
  { id: 'read', labelKey: 'bankStatementStepRead' },
  { id: 'analyze', labelKey: 'bankStatementStepAnalyze' },
  { id: 'process', labelKey: 'bankStatementStepProcess' },
  { id: 'save', labelKey: 'bankStatementStepSave' },
] as const;

type BankStatementUploadModalProps = {
  companyId: string;
  onClose: () => void;
  onComplete: (statement: BankStatementLite, raw: BankSheetData) => void;
  importFile: (file: File) => Promise<{ raw: BankSheetData }>;
  showToast: (message: string, type?: string) => void;
};

type UploadResult = BankStatementLite & { status?: string | null };

function uploadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'فشل الرفع';
}

function unwrapUploadResult(data: unknown): UploadResult | null {
  if (!data || typeof data !== 'object') return null;
  if ('data' in data && data.data && typeof data.data === 'object') return data.data as UploadResult;
  return data as UploadResult;
}

export default function BankStatementUploadModal({ companyId, onClose, onComplete, importFile, showToast }: BankStatementUploadModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [raw, setRaw] = useState<BankSheetData | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSelectFile = async (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    const ext = (selectedFile.name || '').toLowerCase().split('.').pop() || '';
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast(t('bankStatementInvalidFormat') || 'صيغة غير مدعومة. استخدم Excel أو CSV.', 'error');
      return;
    }
    setFile(selectedFile);
    setError(null);
    setStep(1);

    try {
      const { raw: rows } = await importFile(selectedFile);
      setRaw(rows);
      setStep(2);

      const res = await bankStatementUpload({
        companyId,
        fileName: selectedFile.name,
        fileFormat: ext === 'csv' ? 'csv' : 'excel',
        raw: rows,
      });

      if (!res?.success && res?.error) {
        setError(String(res.error));
        return;
      }
      setStep(3);
      setStep(4);
      const stmt = unwrapUploadResult(res?.data ?? res);
      if (stmt) {
        setResult(stmt);
        onComplete(stmt, rows);
      }
    } catch (err: unknown) {
      setError(uploadErrorMessage(err));
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleSelectFile(event.dataTransfer.files?.[0]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleSelectFile(event.target.files?.[0]);
    event.target.value = '';
  };

  return (
    <AdaptiveSheet
      open
      onClose={onClose}
      title={t('bankStatementUploadTitle')}
      size="md"
      side="start"
      className="bank-upload-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {step >= 4 ? t('close') : t('cancel')}
          </Button>
          {step >= 4 && result?.status === 'mapping' && (
            <Button variant="primary" onClick={onClose}>
              {t('bankStatementGoToMapping')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-1 mb-5">
        {STEPS.map((item, index) => (
          <div
            key={item.id}
            className={`flex-1 min-w-0 h-1 rounded-sm ${index <= step ? 'bg-noorix-blue' : 'bg-noorix-border'}`}
            title={t(item.labelKey)}
          />
        ))}
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-lg text-[13px] bg-[var(--noorix-red-10)] text-noorix-red">
          {error}
        </div>
      )}

      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`rounded-xl text-center cursor-pointer p-10 border-2 border-dashed ${
            isDragging ? 'border-noorix-blue bg-[var(--noorix-blue-5)]' : 'border-noorix-border bg-noorix-bg-muted'
          }`}
        >
          <div className="mb-2 text-[36px]"></div>
          <div className="text-[15px] font-semibold text-noorix-text">{t('bankStatementDragDrop')}</div>
          <div className="text-[12px] text-noorix-muted mt-1">Excel (.xlsx, .xls) أو CSV</div>
          <FileTrigger
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleInputChange}
            label=""
            buttonProps={{ className: 'hidden', 'aria-hidden': true, tabIndex: -1 }}
          />
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex items-center gap-12 p-3 bg-noorix-bg-muted rounded-lg">
            <span className="text-[24px]"></span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-noorix-text">{file.name}</div>
              <div className="text-[12px] text-noorix-muted">
                {raw?.length ?? 0} صف • {step >= 4 ? t('bankStatementStepDone') : STEPS[step] && t(STEPS[step].labelKey)}
              </div>
            </div>
            {step >= 4 && <span className="text-[14px] text-noorix-green">✓</span>}
          </div>
          {result?.status === 'mapping' && (
            <div className="p-3 rounded-lg text-[13px] text-noorix-text bg-[var(--noorix-green-10)]">
              {t('bankStatementMappingRequired')}
            </div>
          )}
        </div>
      )}
    </AdaptiveSheet>
  );
}
