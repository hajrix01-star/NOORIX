/**
 * BankStatementUploadModal — رفع ملف كشف مع سير العمل من 5 خطوات
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { bankStatementUpload } from '../../services/api';
import { importBankStatementFile } from '../../utils/exportUtils';
import { Button, AdaptiveSheet } from '../../ui';

const STEPS = [
  { id: 'upload', labelKey: 'bankStatementStepUpload' },
  { id: 'read', labelKey: 'bankStatementStepRead' },
  { id: 'analyze', labelKey: 'bankStatementStepAnalyze' },
  { id: 'process', labelKey: 'bankStatementStepProcess' },
  { id: 'save', labelKey: 'bankStatementStepSave' },
];

export default function BankStatementUploadModal({ companyId, onClose, onComplete, importFile, showToast }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [raw, setRaw] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSelectFile = async (selectedFile) => {
    if (!selectedFile) return;
    const ext = (selectedFile.name || '').toLowerCase().split('.').pop();
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
        setError(res.error);
        return;
      }
      setStep(3);
      setStep(4);
      const stmt = res?.data ?? res;
      setResult(stmt);
      onComplete(stmt, rows);
    } catch (err) {
      setError(err?.message || 'فشل الرفع');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleSelectFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e) => {
    const f = e.target?.files?.[0];
    if (f) handleSelectFile(f);
    e.target.value = '';
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
      {/* خطوات التقدم */}
      <div className="flex gap-1 mb-5">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className="flex-1 min-w-0 h-1 rounded-sm"
            style={{
              background: i <= step ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)',
            }}
            title={t(s.labelKey)}
          />
        ))}
      </div>

      {error && (
        <div
          className="p-3 mb-4 rounded-lg text-[13px]"
          style={{
            background: 'var(--noorix-red-10)',
            color: 'var(--noorix-error)',
          }}
        >
          {error}
        </div>
      )}

      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl text-center cursor-pointer p-10"
          style={{
            border: `2px dashed ${isDragging ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)'}`,
            background: isDragging ? 'var(--noorix-blue-5)' : 'var(--noorix-bg-muted)',
          }}
        >
          <div className="mb-2 text-[36px]"></div>
          <div className="text-[15px] font-semibold text-noorix-text">
            {t('bankStatementDragDrop')}
          </div>
          <div className="text-[12px] text-noorix-muted mt-1">
            Excel (.xlsx, .xls) أو CSV
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} hidden />
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
            {step >= 4 && (
              <span className="text-[14px]" style={{ color: 'var(--noorix-success)' }}>✓</span>
            )}
          </div>
          {result?.status === 'mapping' && (
            <div
            className="p-3 rounded-lg text-[13px] text-noorix-text"
            style={{
              background: 'var(--noorix-green-10)',
            }}
            >
              {t('bankStatementMappingRequired')}
            </div>
          )}
        </div>
      )}
    </AdaptiveSheet>
  );
}
