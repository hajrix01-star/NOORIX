/**
 * BankStatementUploadModal — رفع ملف كشف مع سير العمل من 5 خطوات
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { bankStatementUpload } from '../../services/api';
import { importBankStatementFile } from '../../utils/exportUtils';
import './bankStatement.css';

const STEPS = [
  { id: 'upload', labelKey: 'bankStatementStepUpload' },
  { id: 'read', labelKey: 'bankStatementStepRead' },
  { id: 'analyze', labelKey: 'bankStatementStepAnalyze' },
  { id: 'process', labelKey: 'bankStatementStepProcess' },
  { id: 'save', labelKey: 'bankStatementStepSave' },
];

export default function BankStatementUploadModal({ companyId, onClose, onComplete, importFile = importBankStatementFile, showToast }) {
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
    <div
      className="noorix-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="noorix-surface-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 95vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('bankStatementUploadTitle')}</h2>
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>

        <div className="bank-statement__step-bar">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`bank-statement__step ${i < step ? 'bank-statement__step--done' : ''} ${i === step ? 'bank-statement__step--active' : ''}`}
              title={t(s.labelKey)}
            />
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              background: 'rgba(239,68,68,0.1)',
              borderRadius: 8,
              color: 'var(--noorix-error)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {!file ? (
          <div
            className={`bank-statement__dropzone ${isDragging ? 'bank-statement__dropzone--dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="bank-statement__dropzone-icon">📄</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--noorix-text)' }}>
              {t('bankStatementDragDrop')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4 }}>
              Excel (.xlsx, .xls) أو CSV
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleInputChange} hidden />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: 'var(--noorix-bg-muted)',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 24 }}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--noorix-text)' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>
                  {raw?.length ?? 0} صف • {step >= 4 ? t('bankStatementStepDone') : STEPS[step] && t(STEPS[step].labelKey)}
                </div>
              </div>
              {step >= 4 && (
                <span style={{ color: 'var(--noorix-success)', fontSize: 14 }}>✓</span>
              )}
            </div>
            {result?.status === 'mapping' && (
              <div
                style={{
                  padding: 12,
                  background: 'rgba(34,197,94,0.1)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--noorix-text)',
                }}
              >
                {t('bankStatementMappingRequired')}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 8 }}>
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose}>
            {step >= 4 ? t('close') : t('cancel')}
          </button>
          {step >= 4 && result?.status === 'mapping' && (
            <button type="button" className="noorix-btn noorix-btn--primary" onClick={onClose}>
              {t('bankStatementGoToMapping')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
