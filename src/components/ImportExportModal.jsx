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

/** دمج أخطاء دفعة الموظفين مع أرقام الصفوف (السيرفر يعيد created/failed وليس نجاح كل الصفوف) */
function appendEmployeesBatchErrors(batchErrors, slice, errors) {
  if (!Array.isArray(batchErrors)) return;
  for (const err of batchErrors) {
    if (err && typeof err === 'object' && typeof err.index === 'number') {
      const rowEntry = slice[err.index];
      errors.push({
        rowNum: rowEntry?.rowNum ?? err.index + 2,
        message: err.message || 'خطأ',
      });
    } else if (typeof err === 'string') {
      const m = err.match(/^([^:]+):\s*(.+)$/s);
      const empName = m ? m[1].trim() : '';
      const msg = m ? m[2].trim() : err;
      const rowEntry = slice.find((x) => (x.payload?.name || '').trim() === empName);
      errors.push({ rowNum: rowEntry?.rowNum ?? '?', message: msg });
    }
  }
}

function appendEmployeesBatchWarnings(batchWarnings, slice, warnings) {
  if (!Array.isArray(batchWarnings)) return;
  for (const w of batchWarnings) {
    if (w && typeof w === 'object' && typeof w.index === 'number') {
      const rowEntry = slice[w.index];
      warnings.push({
        rowNum: rowEntry?.rowNum ?? w.index + 2,
        message: w.message || '',
      });
    }
  }
}

/** شريط مراحل الاستيراد — يوضح أين المستخدم في التدفق */
function ImportPhaseSteps({ phase, importing }) {
  const steps = [
    { n: 1, label: 'القالب' },
    { n: 2, label: 'رفع الملف' },
    { n: 3, label: 'المعاينة والفحص' },
    { n: 4, label: 'التنفيذ' },
    { n: 5, label: 'النتيجة' },
  ];
  let active = 1;
  if (phase === 'parsing') active = 2;
  else if (phase === 'validated' && !importing) active = 3;
  else if (importing) active = 4;
  else if (phase === 'done') active = 5;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
      padding: '12px 14px', borderRadius: 12, border: '1px solid var(--noorix-border)',
      background: 'var(--noorix-bg)', marginBottom: 4,
    }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          {i > 0 && <span style={{ color: 'var(--noorix-text-muted)', fontSize: 12, userSelect: 'none' }}>→</span>}
          <span style={{
            fontSize: 12, fontWeight: active === s.n ? 800 : 500,
            color: active === s.n ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
            padding: '4px 8px', borderRadius: 8,
            background: active === s.n ? 'rgba(37,99,235,0.1)' : 'transparent',
            whiteSpace: 'nowrap',
          }}>
            {s.n}. {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function EmployeeImportPreviewTable({ validationResults, parsedRows }) {
  const maxRows = 150;
  const slice = validationResults.slice(0, maxRows);
  return (
    <div style={{ marginTop: 12, borderRadius: 10, border: '1px solid var(--noorix-border)', overflow: 'hidden' }}>
      <div style={{
        padding: '8px 12px', fontSize: 12, fontWeight: 700,
        background: 'var(--noorix-bg-muted)', color: 'var(--noorix-text-muted)',
        borderBottom: '1px solid var(--noorix-border)',
      }}>
        معاينة البيانات (أول {Math.min(slice.length, maxRows)} صفاً من أصل {validationResults.length})
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 280 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--noorix-bg-surface)', position: 'sticky', top: 0, zIndex: 1 }}>
              {['#', 'الاسم', 'تاريخ الالتحاق', 'الراتب الأساسي', 'الحالة', 'ملاحظات'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const raw = parsedRows[r.rowNum - 2] || {};
              const nameStr = String(raw['الاسم بالعربية'] ?? raw.name ?? '').trim();
              const name = r.payload?.name ?? (nameStr || '—');
              const jdStr = String(raw['تاريخ الالتحاق'] ?? raw.joinDate ?? '').trim();
              const jd = r.payload?.joinDate ?? (jdStr || '—');
              const salRaw = r.payload?.basicSalary ?? raw['الراتب الأساسي'] ?? raw.basicSalary;
              const sal = salRaw === undefined || salRaw === null || salRaw === '' ? '—' : salRaw;
              const ok = r.valid;
              const note = ok
                ? (r.warnings.length ? r.warnings.join('؛ ') : '—')
                : r.errors.join('؛ ');
              return (
                <tr key={r.rowNum} style={{ background: ok ? 'transparent' : 'rgba(239,68,68,0.06)' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--noorix-border)', fontFamily: 'var(--noorix-font-numbers)' }}>{r.rowNum}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--noorix-border)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--noorix-border)', fontFamily: 'var(--noorix-font-numbers)', whiteSpace: 'nowrap' }}>{jd}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--noorix-border)', fontFamily: 'var(--noorix-font-numbers)' }}>{sal}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--noorix-border)', fontWeight: 700, color: ok ? '#16a34a' : '#dc2626' }}>
                    {ok ? '✓ صالح' : '✗ خطأ'}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--noorix-border)', color: 'var(--noorix-text-muted)', maxWidth: 220 }} title={note}>{note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {validationResults.length > maxRows && (
        <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--noorix-text-muted)', borderTop: '1px solid var(--noorix-border)' }}>
          … و {validationResults.length - maxRows} صفاً إضافياً (كلها مضمّنة في الاستيراد عند نجاح الفحص)
        </div>
      )}
    </div>
  );
}

const EMPLOYEE_EXPORT_COLUMNS_AR = [
  'الاسم بالعربية', 'الاسم بالإنجليزية', 'رقم الموظف', 'رقم الإقامة', 'المسمى الوظيفي',
  'الراتب الأساسي', 'بدل السكن', 'بدل النقل', 'بدلات أخرى', 'تاريخ الالتحاق', 'ساعات العمل', 'الحالة', 'ملاحظات',
];

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
  const [progress, setProgress] = useState({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [], warnings: [] });
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
      setProgress({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [], warnings: [] });
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
      const stamp = new Date().toISOString().slice(0, 10);
      const base = String(cfg.exportFilename || 'export.xlsx').replace(/\.xlsx$/i, '');
      await exportToExcel(rows, `${base}-${stamp}.xlsx`);
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
    setProgress({ current: 0, total, succeeded: 0, failed: 0, errors: [], warnings: [] });

    let succeeded = 0;
    let failed = 0;
    const errors = [];
    const importWarnings = [];

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
        setProgress({ current: i + slice.length, total, succeeded, failed, errors: [...errors], warnings: [...importWarnings] });
      }
    } else if (entityType === 'employees') {
      const batchSize = 50;
      for (let i = 0; i < validResults.length; i += batchSize) {
        if (abortRef.current) break;
        const slice = validResults.slice(i, i + batchSize);
        let res;
        try {
          res = await createEmployeesBatch({
            companyId,
            items: slice.map((r) => ({ ...r.payload, companyId })),
          });
        } catch (err) {
          res = { success: false, error: err?.message ?? 'خطأ شبكة' };
        }
        if (res?.success) {
          const br = res.data || {};
          succeeded += Number(br.created) || 0;
          failed += Number(br.failed) || 0;
          appendEmployeesBatchErrors(br.errors, slice, errors);
          appendEmployeesBatchWarnings(br.warnings, slice, importWarnings);
        } else {
          for (const r of slice) {
            let r2;
            try {
              r2 = await createEmployeesBatch({ companyId, items: [{ ...r.payload, companyId }] });
            } catch (e2) {
              failed += 1;
              errors.push({ rowNum: r.rowNum, message: e2?.message ?? 'خطأ غير معروف' });
              continue;
            }
            if (!r2?.success) {
              failed += 1;
              errors.push({ rowNum: r.rowNum, message: r2?.error || res?.error || 'فشل الاستيراد' });
            } else {
              const br = r2.data || {};
              succeeded += Number(br.created) || 0;
              failed += Number(br.failed) || 0;
              appendEmployeesBatchErrors(br.errors, [r], errors);
              appendEmployeesBatchWarnings(br.warnings, [r], importWarnings);
            }
          }
        }
        setProgress({ current: i + slice.length, total, succeeded, failed, errors: [...errors], warnings: [...importWarnings] });
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
        setProgress({ current: i + 1, total, succeeded, failed, errors: [...errors], warnings: [...importWarnings] });
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

  async function handleDownloadWarningsReport() {
    const list = progress.warnings || [];
    const rows = list.map((w) => ({ 'رقم الصف': w.rowNum, 'التحذير': w.message }));
    await exportToExcel(rows, 'import-warnings.xlsx');
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
                  يتم جلب السجلات من الخادم ثم تنزيل ملف Excel باسم يتضمن تاريخ اليوم. استخدم الفلاتر في الشاشة الرئيسية (عند توفرها) لتحديد نطاق القائمة قبل التصدير.
                </p>
                {entityType === 'employees' && (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ ...S.sectionTitle, marginTop: 0 }}>أعمدة ملف الموظفين</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--noorix-text-muted)', lineHeight: 1.65 }}>
                      {EMPLOYEE_EXPORT_COLUMNS_AR.join(' · ')}
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" style={S.btnPrimary} onClick={handleExport} disabled={exporting}>
                    {exporting ? '⏳ جارٍ التصدير…' : '⬇ تنزيل Excel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── IMPORT TAB ──────────────────────────────────────────────── */}
          {activeTab === 'import' && (
            <>
              <ImportPhaseSteps phase={phase} importing={importing} />

              {/* Step 1: Template — تُخفى بعد اكتمال الاستيراد لتجنب ازدحام الشاشة */}
              {phase !== 'done' && !importing && (
              <div style={S.card}>
                <p style={S.sectionTitle}>الخطوة 1 — تحميل القالب</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.6 }}>
                  حمّل قالب Excel الجاهز، افتحه في Excel أو Google Sheets، أضف بياناتك ثم احفظه.
                  {entityType === 'invoices' && ' أسماء الموردين والصناديق يجب أن تتطابق مع الأسماء المسجلة في النظام.'}
                  {entityType === 'sales' && ' أعمدة القنوات تتطابق مع أسماء الصناديق في نظامك.'}
                  {entityType === 'employees' && ' للقبول في الفحص: الاسم بالعربية أو الإنجليزية (أحدهما كافٍ). باقي الأعمدة اختيارية؛ التاريخ والراتب والبدلات تُستبدل بقيم افتراضية إن وُجدت فارغة.'}
                </p>
                <button type="button" style={S.btnSecondary} onClick={handleDownloadTemplate} disabled={lookupsLoading}>
                  {lookupsLoading ? '⏳ تحميل…' : '⬇ تحميل قالب Excel'}
                </button>
              </div>
              )}

              {/* Step 2: Upload */}
              {phase !== 'done' && !importing && (
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
              {phase === 'validated' && !importing && (
                <div style={S.card}>
                  <p style={S.sectionTitle}>الخطوة 3 — نتائج الفحص والمعاينة</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <StatBadge count={validCount} label="صف صحيح" color="#16a34a" />
                    {errorCount > 0 && <StatBadge count={errorCount} label="بها أخطاء" color="#dc2626" />}
                    {warnCount > 0 && <StatBadge count={warnCount} label="تحذيرات" color="#f59e0b" />}
                  </div>

                  {entityType === 'employees' && validationResults.length > 0 && (
                    <EmployeeImportPreviewTable validationResults={validationResults} parsedRows={parsedRows} />
                  )}

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
                    {(progress.warnings || []).length > 0 && (
                      <StatBadge count={(progress.warnings || []).length} label="تحذيرات من الخادم" color="#d97706" />
                    )}
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
                    {(progress.warnings || []).length > 0 && (
                      <StatBadge count={(progress.warnings || []).length} label="تحذيرات" color="#d97706" />
                    )}
                  </div>

                  {(progress.warnings || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                      {(progress.warnings || []).slice(0, 20).map((w, i) => (
                        <div key={i} style={S.warnRow}>
                          <span style={{ fontWeight: 700, color: '#d97706' }}>صف {w.rowNum}</span>
                          <span style={{ color: '#92400e' }}>⚠ {w.message}</span>
                        </div>
                      ))}
                      {(progress.warnings || []).length > 20 && (
                        <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>… و {(progress.warnings || []).length - 20} تحذير آخر</span>
                      )}
                      <button type="button" style={{ ...S.btnGhost, alignSelf: 'flex-start' }} onClick={handleDownloadWarningsReport}>
                        ⬇ تحميل تقرير التحذيرات
                      </button>
                    </div>
                  )}

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
                    <button type="button" style={S.btnSecondary} onClick={() => { setPhase('idle'); setParsedRows([]); setValidationResults([]); setProgress({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [], warnings: [] }); }}>
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
