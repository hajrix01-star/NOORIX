/**
 * ImportExportModal — نظام استيراد وتصدير موحد
 * Entities: invoices | employees | sales
 *
 * Import flow:
 *   1. User downloads template → fills it → uploads
 *   2. Rows are validated client-side (with lookup resolution)
 *   3. Valid rows are sent to backend in parallel/sequential batches
 *   4. Progress bar tracks completed rows; results show per-row errors
 *
 * Export flow:
 *   1. exportFetcher() is called → returns pre-formatted row objects
 *   2. Exported to Excel with entity-appropriate filename
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { importFromExcel, exportToExcel } from '../utils/exportUtils';
import {
  downloadInvoiceTemplate,
  downloadEmployeeTemplate,
  downloadSalesTemplate,
  validateInvoiceRows,
  validateEmployeeRows,
  validateSalesRows,
} from '../utils/importTemplates';
import {
  apiGet,
  createInvoice,
  createEmployeesBatch,
  createDailySalesSummary,
} from '../services/api';

// ─── Config per entity type ──────────────────────────────────────────────────

const ENTITY_CONFIG = {
  invoices: {
    label: 'الفواتير',
    labelEn: 'Invoices',
    downloadTemplate: null, // set dynamically with lookups
    validate: null,         // set dynamically with lookups
    batchSize: 8,
    parallel: true,
    exportFilename: 'invoices-export.xlsx',
  },
  employees: {
    label: 'الموظفون',
    labelEn: 'Employees',
    downloadTemplate: downloadEmployeeTemplate,
    validate: (rows) => validateEmployeeRows(rows),
    batchSize: 50,
    parallel: false,
    exportFilename: 'employees-export.xlsx',
  },
  sales: {
    label: 'المبيعات اليومية',
    labelEn: 'Daily Sales',
    downloadTemplate: null, // set dynamically with vaults
    validate: null,         // set dynamically with vaults
    batchSize: 1,
    parallel: false,
    exportFilename: 'daily-sales-export.xlsx',
  },
};

// ─── Colours / styles ────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1200, padding: 16,
  },
  modal: {
    background: 'var(--noorix-bg-surface)',
    borderRadius: 18, width: '100%', maxWidth: 760,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
    border: '1px solid var(--noorix-border)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px 0', flexShrink: 0,
  },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)',
    margin: '0 24px',
  },
  tab: (active) => ({
    padding: '10px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
    color: active ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    borderBottom: active ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
  }),
  body: {
    overflowY: 'auto', padding: '20px 24px 24px', flex: 1,
    display: 'flex', flexDirection: 'column', gap: 18,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--noorix-text-muted)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  card: {
    borderRadius: 12, border: '1px solid var(--noorix-border)',
    padding: 16, background: 'var(--noorix-bg)', display: 'flex', flexDirection: 'column', gap: 12,
  },
  btnPrimary: {
    padding: '9px 18px', borderRadius: 10, background: 'var(--noorix-accent-blue)',
    color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  btnSecondary: {
    padding: '9px 18px', borderRadius: 10,
    background: 'var(--noorix-bg-surface)', color: 'var(--noorix-text)',
    border: '1px solid var(--noorix-border)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
  },
  btnGhost: {
    padding: '7px 14px', borderRadius: 8,
    background: 'transparent', color: 'var(--noorix-text-muted)',
    border: '1px solid var(--noorix-border)', cursor: 'pointer', fontSize: 13,
    display: 'inline-flex', alignItems: 'center', gap: 5,
  },
  dropzone: (dragging) => ({
    border: `2px dashed ${dragging ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)'}`,
    borderRadius: 12, padding: '28px 20px',
    textAlign: 'center', cursor: 'pointer',
    background: dragging ? 'rgba(37,99,235,0.06)' : 'var(--noorix-bg)',
    transition: 'all 0.18s ease',
    color: 'var(--noorix-text-muted)',
  }),
  progressBar: (pct) => ({
    height: 10, borderRadius: 99, overflow: 'hidden',
    background: 'var(--noorix-border)', position: 'relative',
    '& > div': { width: `${pct}%`, height: '100%', background: 'var(--noorix-accent-blue)', transition: 'width 0.3s ease' },
  }),
  errorRow: {
    display: 'grid', gridTemplateColumns: '56px 1fr',
    gap: 8, alignItems: 'start',
    padding: '6px 10px', borderRadius: 8,
    background: 'rgba(239,68,68,0.07)', fontSize: 13,
  },
  warnRow: {
    display: 'grid', gridTemplateColumns: '56px 1fr',
    gap: 8, alignItems: 'start',
    padding: '5px 10px', borderRadius: 8,
    background: 'rgba(245,158,11,0.07)', fontSize: 12,
  },
};

// ─── Small helpers ───────────────────────────────────────────────────────────

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--noorix-border)' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--noorix-accent-blue)', transition: 'width 0.25s ease' }} />
    </div>
  );
}

function StatBadge({ count, label, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 20px', borderRadius: 10, background: color + '14', border: `1px solid ${color}30`, minWidth: 90 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: 'var(--noorix-font-numbers)' }}>{count}</div>
      <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   entityType: 'invoices' | 'employees' | 'sales',
 *   companyId: string,
 *   exportFetcher?: () => Promise<Object[]>,
 *   onImportSuccess?: (count: number) => void,
 * }} props
 */
export default function ImportExportModal({ isOpen, onClose, entityType, companyId, exportFetcher, onImportSuccess }) {
  const [activeTab, setActiveTab] = useState('import');

  // Lookups (suppliers, vaults, categories, expenseLines)
  const [lookups, setLookups] = useState({ suppliers: [], vaults: [], categories: [], expenseLines: [] });
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // Import state machine: idle → parsed → validated → importing → done
  const [phase, setPhase] = useState('idle');
  const [parsedRows, setParsedRows] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [] });
  const [showAllErrors, setShowAllErrors] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(false);

  const cfg = ENTITY_CONFIG[entityType] ?? ENTITY_CONFIG.invoices;

  // ── Fetch lookups when modal opens ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !companyId) return;
    setLookupsLoading(true);
    const promises = [
      apiGet('/api/v1/vaults', { companyId, includeArchived: false }).catch(() => ({})),
    ];
    if (entityType === 'invoices') {
      promises.push(
        apiGet('/api/v1/suppliers', { companyId, pageSize: 500 }).catch(() => ({})),
        apiGet('/api/v1/categories', { companyId }).catch(() => []),
        apiGet('/api/v1/expense-lines', { companyId, includeInactive: false }).catch(() => []),
      );
    }
    Promise.all(promises)
      .then(([vaultsRes, suppliersRes, categoriesRes, expLinesRes]) => {
        const rawVaults = Array.isArray(vaultsRes) ? vaultsRes : (vaultsRes?.items ?? []);
        setLookups({
          vaults: rawVaults.filter((v) => v.showAsPaymentMethod !== false),
          suppliers: Array.isArray(suppliersRes) ? suppliersRes : (suppliersRes?.items ?? []),
          categories: Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.items ?? []),
          expenseLines: Array.isArray(expLinesRes) ? expLinesRes : (expLinesRes?.items ?? []),
        });
      })
      .finally(() => setLookupsLoading(false));
  }, [isOpen, companyId, entityType]);

  // ── Reset when modal closes ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setParsedRows([]);
      setValidationResults([]);
      setImporting(false);
      setProgress({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [] });
      setShowAllErrors(false);
      abortRef.current = false;
    }
  }, [isOpen]);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      alert('يرجى رفع ملف Excel (.xlsx/.xls) أو CSV');
      return;
    }
    setPhase('parsing');
    setValidationResults([]);
    try {
      const rows = await importFromExcel(file);
      if (!rows.length) { setPhase('idle'); alert('الملف فارغ أو لا يحتوي على بيانات'); return; }
      setParsedRows(rows);

      // Run validation immediately
      let results;
      if (entityType === 'invoices') {
        results = validateInvoiceRows(rows, lookups);
      } else if (entityType === 'employees') {
        results = validateEmployeeRows(rows);
      } else {
        results = validateSalesRows(rows, { vaults: lookups.vaults });
      }
      setValidationResults(results);
      setPhase('validated');
    } catch (err) {
      setPhase('idle');
      alert('حدث خطأ أثناء قراءة الملف: ' + (err?.message ?? 'خطأ غير متوقع'));
    }
  }, [entityType, lookups]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  // ── Template download ─────────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    if (entityType === 'invoices') await downloadInvoiceTemplate();
    else if (entityType === 'employees') await downloadEmployeeTemplate();
    else await downloadSalesTemplate(lookups.vaults);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!exportFetcher) return;
    setExporting(true);
    try {
      const rows = await exportFetcher();
      if (!rows.length) { alert('لا توجد بيانات للتصدير'); return; }
      await exportToExcel(rows, cfg.exportFilename);
    } catch (err) {
      alert('خطأ في التصدير: ' + (err?.message ?? ''));
    } finally {
      setExporting(false);
    }
  }

  // ── Import execution ──────────────────────────────────────────────────────
  async function handleImport() {
    const validResults = validationResults.filter((r) => r.valid);
    if (!validResults.length) return;

    abortRef.current = false;
    setImporting(true);
    const total = validResults.length;
    setProgress({ current: 0, total, succeeded: 0, failed: 0, errors: [] });

    let succeeded = 0;
    let failed = 0;
    const errors = [];

    if (entityType === 'invoices') {
      // Send in parallel batches of 8
      const batchSize = 8;
      for (let i = 0; i < validResults.length; i += batchSize) {
        if (abortRef.current) break;
        const slice = validResults.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          slice.map((r) => createInvoice({ ...r.payload, companyId })),
        );
        results.forEach((res, idx) => {
          const rowNum = slice[idx].rowNum;
          if (res.status === 'fulfilled') {
            succeeded++;
          } else {
            failed++;
            errors.push({ rowNum, message: res.reason?.message ?? 'خطأ غير معروف' });
          }
        });
        setProgress({ current: i + slice.length, total, succeeded, failed, errors: [...errors] });
      }
    } else if (entityType === 'employees') {
      // Send in batches of 50 using the batch endpoint
      const batchSize = 50;
      for (let i = 0; i < validResults.length; i += batchSize) {
        if (abortRef.current) break;
        const slice = validResults.slice(i, i + batchSize);
        try {
          await createEmployeesBatch({
            companyId,
            items: slice.map((r) => ({ ...r.payload, companyId })),
          });
          succeeded += slice.length;
        } catch (err) {
          // Try one-by-one to identify failing rows
          for (const r of slice) {
            try {
              await createEmployeesBatch({ companyId, items: [{ ...r.payload, companyId }] });
              succeeded++;
            } catch (e2) {
              failed++;
              errors.push({ rowNum: r.rowNum, message: e2?.message ?? 'خطأ غير معروف' });
            }
          }
        }
        setProgress({ current: i + slice.length, total, succeeded, failed, errors: [...errors] });
      }
    } else if (entityType === 'sales') {
      // Sequential — each day is a unique summary
      for (let i = 0; i < validResults.length; i++) {
        if (abortRef.current) break;
        const r = validResults[i];
        try {
          await createDailySalesSummary({ ...r.payload, companyId });
          succeeded++;
        } catch (err) {
          failed++;
          errors.push({ rowNum: r.rowNum, message: err?.message ?? 'خطأ غير معروف' });
        }
        setProgress({ current: i + 1, total, succeeded, failed, errors: [...errors] });
      }
    }

    setImporting(false);
    setPhase('done');
    if (succeeded > 0 && typeof onImportSuccess === 'function') onImportSuccess(succeeded);
  }

  // ── Download error report ─────────────────────────────────────────────────
  async function handleDownloadErrorReport() {
    const rows = progress.errors.map((e) => ({ 'رقم الصف': e.rowNum, 'الخطأ': e.message }));
    await exportToExcel(rows, 'import-errors.xlsx');
  }

  async function handleDownloadValidationErrors() {
    const rows = validationResults
      .filter((r) => !r.valid || r.warnings.length > 0)
      .flatMap((r) => [
        ...r.errors.map((msg) => ({ 'رقم الصف': r.rowNum, 'النوع': 'خطأ', 'الوصف': msg })),
        ...r.warnings.map((msg) => ({ 'رقم الصف': r.rowNum, 'النوع': 'تحذير', 'الوصف': msg })),
      ]);
    await exportToExcel(rows, 'validation-errors.xlsx');
  }

  if (!isOpen) return null;

  const validCount = validationResults.filter((r) => r.valid).length;
  const errorCount = validationResults.filter((r) => !r.valid).length;
  const warnCount = validationResults.filter((r) => r.valid && r.warnings.length > 0).length;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const errorsToShow = showAllErrors ? validationResults.filter((r) => !r.valid || r.warnings.length > 0) : validationResults.filter((r) => !r.valid || r.warnings.length > 0).slice(0, 10);

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && !importing && onClose()}>
      <div style={S.modal} role="dialog" aria-modal="true">

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>استيراد وتصدير — {cfg.label}</h2>
            {lookupsLoading && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--noorix-text-muted)' }}>جارٍ تحميل بيانات النظام…</p>}
          </div>
          <button type="button" onClick={onClose} disabled={importing} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--noorix-text-muted)', lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          <button type="button" style={S.tab(activeTab === 'import')} onClick={() => setActiveTab('import')}>⬆ استيراد</button>
          {exportFetcher && (
            <button type="button" style={S.tab(activeTab === 'export')} onClick={() => setActiveTab('export')}>⬇ تصدير</button>
          )}
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* ── EXPORT TAB ─────────────────────────────────────────────── */}
          {activeTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...S.card, gap: 10 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--noorix-text-muted)', lineHeight: 1.6 }}>
                  يتم تصدير البيانات المفلترة حالياً بصيغة Excel. يمكنك استخدام الفلاتر في الشاشة الرئيسية قبل الفتح لتحديد نطاق التصدير.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" style={S.btnPrimary} onClick={handleExport} disabled={exporting}>
                    {exporting ? '⏳ جارٍ التصدير…' : '⬇ تصدير Excel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── IMPORT TAB ──────────────────────────────────────────────── */}
          {activeTab === 'import' && (
            <>
              {/* Step 1: Template */}
              <div style={S.card}>
                <p style={S.sectionTitle}>الخطوة 1 — تحميل القالب</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.6 }}>
                  حمّل قالب Excel الجاهز، افتحه في Excel أو Google Sheets، أضف بياناتك ثم احفظه.
                  {entityType === 'invoices' && ' أسماء الموردين والصناديق يجب أن تتطابق مع الأسماء المسجلة في النظام.'}
                  {entityType === 'sales' && ' أعمدة القنوات تتطابق مع أسماء الصناديق في نظامك.'}
                </p>
                <button type="button" style={S.btnSecondary} onClick={handleDownloadTemplate} disabled={lookupsLoading}>
                  {lookupsLoading ? '⏳ تحميل…' : '⬇ تحميل قالب Excel'}
                </button>
              </div>

              {/* Step 2: Upload */}
              {phase !== 'done' && (
                <div style={S.card}>
                  <p style={S.sectionTitle}>الخطوة 2 — رفع الملف</p>
                  <div
                    style={S.dropzone(dragging)}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                  >
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      {phase === 'parsing' ? 'جارٍ قراءة الملف…' : 'اسحب ملف Excel هنا أو انقر للاختيار'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>xlsx / xls / csv</div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  {parsedRows.length > 0 && (
                    <div style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>
                      ✓ تم قراءة <strong>{parsedRows.length}</strong> صف من الملف
                      {phase !== 'done' && (
                        <button type="button" style={{ ...S.btnGhost, marginRight: 12 }} onClick={() => fileInputRef.current?.click()}>
                          تغيير الملف
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Validation results */}
              {phase === 'validated' && (
                <div style={S.card}>
                  <p style={S.sectionTitle}>الخطوة 3 — نتائج الفحص</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <StatBadge count={validCount} label="صف صحيح" color="#16a34a" />
                    {errorCount > 0 && <StatBadge count={errorCount} label="بها أخطاء" color="#dc2626" />}
                    {warnCount > 0 && <StatBadge count={warnCount} label="تحذيرات" color="#f59e0b" />}
                  </div>

                  {(errorCount > 0 || warnCount > 0) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                      {errorsToShow.map((r) => (
                        <div key={r.rowNum}>
                          {r.errors.map((msg, j) => (
                            <div key={j} style={S.errorRow}>
                              <span style={{ fontWeight: 700, color: '#dc2626' }}>صف {r.rowNum}</span>
                              <span style={{ color: '#dc2626' }}>✗ {msg}</span>
                            </div>
                          ))}
                          {r.warnings.map((msg, j) => (
                            <div key={`w${j}`} style={S.warnRow}>
                              <span style={{ fontWeight: 700, color: '#d97706' }}>صف {r.rowNum}</span>
                              <span style={{ color: '#92400e' }}>⚠ {msg}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                      {validationResults.filter((r) => !r.valid || r.warnings.length > 0).length > 10 && (
                        <button type="button" style={{ ...S.btnGhost, alignSelf: 'flex-start' }} onClick={() => setShowAllErrors(!showAllErrors)}>
                          {showAllErrors ? 'عرض أقل' : `عرض الكل (${validationResults.filter((r) => !r.valid || r.warnings.length > 0).length})`}
                        </button>
                      )}
                      <button type="button" style={{ ...S.btnGhost, alignSelf: 'flex-start' }} onClick={handleDownloadValidationErrors}>
                        ⬇ تحميل تقرير الفحص
                      </button>
                    </div>
                  )}

                  {validCount === 0 ? (
                    <div style={{ fontSize: 14, color: '#dc2626', fontWeight: 600 }}>
                      لا توجد صفوف صحيحة للاستيراد. يرجى مراجعة الأخطاء وإعادة رفع الملف.
                    </div>
                  ) : (
                    <button type="button" style={{ ...S.btnPrimary, alignSelf: 'flex-start' }} onClick={handleImport}>
                      ⬆ استيراد {validCount} صف{errorCount > 0 ? ` (سيتم تخطي ${errorCount} صف به أخطاء)` : ''}
                    </button>
                  )}
                </div>
              )}

              {/* Step 4: Progress */}
              {importing && (
                <div style={S.card}>
                  <p style={S.sectionTitle}>جارٍ الاستيراد…</p>
                  <ProgressBar pct={pct} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--noorix-text-muted)' }}>
                    <span>{progress.current} / {progress.total} صف</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <StatBadge count={progress.succeeded} label="نجح" color="#16a34a" />
                    {progress.failed > 0 && <StatBadge count={progress.failed} label="فشل" color="#dc2626" />}
                  </div>
                  <button type="button" style={{ ...S.btnGhost, alignSelf: 'flex-start', color: '#dc2626', borderColor: '#dc2626' }} onClick={() => { abortRef.current = true; }}>
                    إيقاف
                  </button>
                </div>
              )}

              {/* Step 5: Done */}
              {phase === 'done' && !importing && (
                <div style={{ ...S.card, border: `1px solid ${progress.failed === 0 ? '#16a34a' : '#f59e0b'}40` }}>
                  <p style={S.sectionTitle}>نتائج الاستيراد</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <StatBadge count={progress.succeeded} label="تم بنجاح" color="#16a34a" />
                    {progress.failed > 0 && <StatBadge count={progress.failed} label="فشل" color="#dc2626" />}
                  </div>

                  {progress.errors.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                      {progress.errors.slice(0, 20).map((e, i) => (
                        <div key={i} style={S.errorRow}>
                          <span style={{ fontWeight: 700, color: '#dc2626' }}>صف {e.rowNum}</span>
                          <span style={{ color: '#dc2626' }}>✗ {e.message}</span>
                        </div>
                      ))}
                      {progress.errors.length > 20 && (
                        <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>… و {progress.errors.length - 20} خطأ آخر</span>
                      )}
                      <button type="button" style={{ ...S.btnGhost, alignSelf: 'flex-start' }} onClick={handleDownloadErrorReport}>
                        ⬇ تحميل تقرير الأخطاء
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" style={S.btnPrimary} onClick={onClose}>إغلاق</button>
                    <button type="button" style={S.btnSecondary} onClick={() => { setPhase('idle'); setParsedRows([]); setValidationResults([]); setProgress({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [] }); }}>
                      استيراد ملف آخر
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
