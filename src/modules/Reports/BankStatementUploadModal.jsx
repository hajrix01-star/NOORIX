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
      <div className="nx-flex nx-gap-4 nx-mb-20">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className="nx-flex-1"
            style={{
              height: 4,
              borderRadius: 2,
              background: i <= step ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)',
            }}
            title={t(s.labelKey)}
          />
        ))}
      </div>

      {error && (
        <div
          className="nx-p-12 nx-mb-16 nx-rounded nx-text-base"
          style={{
            background: 'rgba(239,68,68,0.1)',
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
          className="nx-rounded-lg nx-text-center nx-cursor-pointer"
          style={{
            border: `2px dashed ${isDragging ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)'}`,
            padding: 40,
            background: isDragging ? 'rgba(37,99,235,0.05)' : 'var(--noorix-bg-muted)',
          }}
        >
          <div className="nx-mb-8" style={{ fontSize: 36 }}></div>
          <div className="nx-text-lg nx-font-600 nx-text-primary">
            {t('bankStatementDragDrop')}
          </div>
          <div className="nx-text-sm nx-text-muted nx-mt-4">
            Excel (.xlsx, .xls) أو CSV
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} hidden />
        </div>
      ) : (
        <div className="nx-grid nx-gap-12">
          <div className="flex items-center gap-12 nx-p-12 nx-bg-muted nx-rounded">
            <span style={{ fontSize: 24 }}></span>
            <div className="nx-flex-1" style={{ minWidth: 0 }}>
              <div className="nx-font-600 nx-text-primary">{file.name}</div>
              <div className="nx-text-sm nx-text-muted">
                {raw?.length ?? 0} صف • {step >= 4 ? t('bankStatementStepDone') : STEPS[step] && t(STEPS[step].labelKey)}
              </div>
            </div>
            {step >= 4 && (
              <span className="nx-text-md" style={{ color: 'var(--noorix-success)' }}>✓</span>
            )}
          </div>
          {result?.status === 'mapping' && (
            <div
            className="nx-p-12 nx-rounded nx-text-base nx-text-primary"
            style={{
              background: 'rgba(34,197,94,0.1)',
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
