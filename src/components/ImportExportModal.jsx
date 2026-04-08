/**
 * ImportExportModal ? ???? ??????? ?????? ????
 * Entities: invoices | employees | sales
 *
 * Import flow:
 *   1. User downloads template ? fills it ? uploads
 *   2. Rows are validated client-side (with lookup resolution)
 *   3. Valid rows are sent to backend in parallel/sequential batches
 *   4. Progress bar tracks completed rows; results show per-row errors
 *
 * Export flow:
 *   1. exportFetcher() is called ? returns pre-formatted row objects
 *   2. Exported to Excel with entity-appropriate filename
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  getPaymentVaults,
} from '../services/api';
import { Button, AdaptiveSheet, ScreenTabs } from '../ui';
import { useTranslation } from '../i18n/useTranslation';

// ??? Config per entity type ??????????????????????????????????????????????????

const ENTITY_CONFIG = {
  invoices: {
    label: '????????',
    labelEn: 'Invoices',
    downloadTemplate: null,
    validate: null,
    batchSize: 8,
    parallel: true,
    exportFilename: 'invoices-export.xlsx',
  },
  employees: {
    label: '????????',
    labelEn: 'Employees',
    downloadTemplate: downloadEmployeeTemplate,
    validate: (rows) => validateEmployeeRows(rows),
    batchSize: 50,
    parallel: false,
    exportFilename: 'employees-export.xlsx',
  },
  sales: {
    label: '???????? ???????',
    labelEn: 'Daily Sales',
    downloadTemplate: null,
    validate: null,
    batchSize: 1,
    parallel: false,
    exportFilename: 'daily-sales-export.xlsx',
  },
};

// ??? Styles ???????????????????????????????????????????????????????????????????

const S = {
  tabs: {
    display: 'flex', gap: 0, borderBottom: '1px solid var(--noorix-border)',
    marginBottom: 16,
  },
  tab: (active) => ({
    padding: '10px 20px', fontSize: 14, fontWeight: active ? 700 : 500,
    color: active ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
    background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    borderBottom: active ? '2px solid var(--noorix-accent-blue)' : '2px solid transparent',
  }),
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--noorix-text-muted)',
    textTransform: 'uppercase', marginBottom: 8,
  },
  card: {
    borderRadius: 12, border: '1px solid var(--noorix-border)',
    padding: 16, background: 'var(--noorix-bg)', display: 'flex', flexDirection: 'column', gap: 12,
  },
  dropzone: (dragging) => ({
    border: `2px dashed ${dragging ? 'var(--noorix-accent-blue)' : 'var(--noorix-border)'}`,
    borderRadius: 12, padding: '28px 20px',
    textAlign: 'center', cursor: 'pointer',
    background: dragging ? 'var(--noorix-blue-6)' : 'var(--noorix-bg)',
    transition: 'all 0.18s ease',
    color: 'var(--noorix-text-muted)',
  }),
  errorRow: {
    display: 'grid', gridTemplateColumns: '56px 1fr',
    gap: 8, alignItems: 'start',
    padding: '6px 10px', borderRadius: 8,
    background: 'var(--noorix-red-7)', fontSize: 13,
  },
  warnRow: {
    display: 'grid', gridTemplateColumns: '56px 1fr',
    gap: 8, alignItems: 'start',
    padding: '5px 10px', borderRadius: 8,
    background: 'var(--noorix-yellow-7)', fontSize: 12,
  },
};

// ??? Small helpers ???????????????????????????????????????????????????????????

function ProgressBar({ pct }) {
  return (
    <div className="h-[10px] rounded-full overflow-hidden bg-noorix-border">
      <div className="nx-progress-fill" style={{ width: `${pct}%`, background: 'var(--noorix-accent-blue)' }} />
    </div>
  );
}

function StatBadge({ count, label, color }) {
  return (
    <div className="text-center" style={{ padding: '10px 20px', borderRadius: 10, background: color + '14', border: `1px solid ${color}30`, minWidth: 90 }}>
      <div className="text-[26px] font-black" style={{ color, fontFamily: 'var(--noorix-font-numbers)' }}>{count}</div>
      <div className="text-[12px] text-noorix-muted mt-0.5">{label}</div>
    </div>
  );
}

/** ??? ????? ???? ???????? ?? ????? ?????? */
function appendEmployeesBatchErrors(batchErrors, slice, errors) {
  if (!Array.isArray(batchErrors)) return;
  for (const err of batchErrors) {
    if (err && typeof err === 'object' && typeof err.index === 'number') {
      const rowEntry = slice[err.index];
      errors.push({
        rowNum: rowEntry?.rowNum ?? err.index + 2,
        message: err.message || '???',
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

/** ???? ????? ????????? */
function ImportPhaseSteps({ phase, importing }) {
  const steps = [
    { n: 1, label: '??????' },
    { n: 2, label: '??? ?????' },
    { n: 3, label: '???????? ??????' },
    { n: 4, label: '???????' },
    { n: 5, label: '???????' },
  ];
  let active = 1;
  if (phase === 'parsing') active = 2;
  else if (phase === 'validated' && !importing) active = 3;
  else if (importing) active = 4;
  else if (phase === 'done') active = 5;

  return (
    <div className="flex items-center gap-6 rounded-xl flex-wrap border border-noorix-border py-3 px-[14px] bg-noorix-bg mb-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          {i > 0 && <span className="text-noorix-muted text-[12px] select-none">?</span>}
          <span className="text-[12px] rounded-lg whitespace-nowrap" style={{
            fontWeight: active === s.n ? 800 : 500,
            color: active === s.n ? 'var(--noorix-accent-blue)' : 'var(--noorix-text-muted)',
            padding: '4px 8px',
            background: active === s.n ? 'var(--noorix-blue-10)' : 'transparent',
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
    <div className="mt-3 overflow-hidden rounded-lg border border-noorix-border">
      <div className="bg-noorix-bg-muted text-[12px] font-bold text-noorix-muted py-2 px-3 border-b border-noorix-border">
        ?????? ???????? (??? {Math.min(slice.length, maxRows)} ???? ?? ??? {validationResults.length})
      </div>
      <div className="overflow-auto max-h-[280px]">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-noorix-surface sticky top-0 z-[1]">
              {['#', '?????', '????? ????????', '?????? ???????', '??????', '???????'].map((h) => (
                <th key={h} className="border-b border-noorix-border whitespace-nowrap py-2 px-2.5 text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const raw = parsedRows[r.rowNum - 2] || {};
              const nameStr = String(raw['????? ????????'] ?? raw.name ?? '').trim();
              const name = r.payload?.name ?? (nameStr || '?');
              const jdStr = String(raw['????? ????????'] ?? raw.joinDate ?? '').trim();
              const jd = r.payload?.joinDate ?? (jdStr || '?');
              const salRaw = r.payload?.basicSalary ?? raw['?????? ???????'] ?? raw.basicSalary;
              const sal = salRaw === undefined || salRaw === null || salRaw === '' ? '?' : salRaw;
              const ok = r.valid;
              const note = ok
                ? (r.warnings.length ? r.warnings.join('? ') : '?')
                : r.errors.join('? ');
              return (
                <tr key={r.rowNum} style={{ background: ok ? 'transparent' : 'var(--noorix-red-6)' }}>
                  <td className="border-b border-noorix-border py-[7px] px-2.5" style={{ fontFamily: "var(--noorix-font-numbers)" }}>{r.rowNum}</td>
                  <td className="border-b border-noorix-border truncate py-[7px] px-2.5 max-w-[160px]">{name}</td>
                  <td className="border-b border-noorix-border whitespace-nowrap py-[7px] px-2.5" style={{ fontFamily: "var(--noorix-font-numbers)" }}>{jd}</td>
                  <td className="border-b border-noorix-border py-[7px] px-2.5" style={{ fontFamily: "var(--noorix-font-numbers)" }}>{sal}</td>
                  <td className="border-b border-noorix-border font-bold py-[7px] px-2.5" style={{ color: ok ? 'var(--noorix-accent-green)' : 'var(--noorix-accent-red)' }}>
                    {ok ? '? ????' : '? ???'}
                  </td>
                  <td className="border-b border-noorix-border text-noorix-muted truncate py-[7px] px-2.5 max-w-[220px]" title={note}>{note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {validationResults.length > maxRows && (
        <div className="text-[11px] text-noorix-muted py-1.5 px-3 border-t border-noorix-border">
          ? ? {validationResults.length - maxRows} ???? ??????? (???? ?????? ?? ????????? ??? ???? ?????)
        </div>
      )}
    </div>
  );
}

const EMPLOYEE_EXPORT_COLUMNS_AR = [
  '????? ????????', '????? ???????????', '??? ??????', '??? ???????', '?????? ???????',
  '?????? ???????', '??? ?????', '??? ?????', '????? ????', '????? ????????', '????? ?????', '??????', '???????',
];

// ??? Main component ??????????????????????????????????????????????????????????

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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('import');

  const sheetTabItems = useMemo(() => {
    const items = [{ id: 'import', label: t('importDrawerTab') }];
    if (exportFetcher) items.push({ id: 'export', label: t('exportDrawerTab') });
    return items;
  }, [exportFetcher, t]);

  const [lookups, setLookups] = useState({ suppliers: [], vaults: [], categories: [], expenseLines: [] });
  const [lookupsLoading, setLookupsLoading] = useState(false);

  const [phase, setPhase] = useState('idle');
  const [parsedRows, setParsedRows] = useState([]);
  const [validationResults, setValidationResults] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [], warnings: [] });
  const [showAllErrors, setShowAllErrors] = useState(false);

  const [exporting, setExporting] = useState(false);

  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(false);

  const cfg = ENTITY_CONFIG[entityType] ?? ENTITY_CONFIG.invoices;

  useEffect(() => {
    if (!isOpen || !companyId) return;
    setLookupsLoading(true);
    const promises = [
      getPaymentVaults(companyId).catch(() => ({})),
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
        const rawVaults = Array.isArray(vaultsRes?.data) ? vaultsRes.data : (vaultsRes?.data?.items ?? []);
        setLookups({
          vaults: rawVaults,
          suppliers: Array.isArray(suppliersRes) ? suppliersRes : (suppliersRes?.items ?? []),
          categories: Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.items ?? []),
          expenseLines: Array.isArray(expLinesRes) ? expLinesRes : (expLinesRes?.items ?? []),
        });
      })
      .finally(() => setLookupsLoading(false));
  }, [isOpen, companyId, entityType]);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setParsedRows([]);
      setValidationResults([]);
      setImporting(false);
      setProgress({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [], warnings: [] });
      setShowAllErrors(false);
      abortRef.current = false;
      setActiveTab('import');
    }
  }, [isOpen]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      alert('???? ??? ??? Excel (.xlsx/.xls) ?? CSV');
      return;
    }
    setPhase('parsing');
    setValidationResults([]);
    try {
      const rows = await importFromExcel(file);
      if (!rows.length) { setPhase('idle'); alert('????? ???? ?? ?? ????? ??? ??????'); return; }
      setParsedRows(rows);

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
      alert('??? ??? ????? ????? ?????: ' + (err?.message ?? '??? ??? ?????'));
    }
  }, [entityType, lookups]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  async function handleDownloadTemplate() {
    if (entityType === 'invoices') await downloadInvoiceTemplate();
    else if (entityType === 'employees') await downloadEmployeeTemplate();
    else await downloadSalesTemplate(lookups.vaults);
  }

  async function handleExport() {
    if (!exportFetcher) return;
    setExporting(true);
    try {
      const rows = await exportFetcher();
      if (!rows.length) { alert('?? ???? ?????? ???????'); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      const base = String(cfg.exportFilename || 'export.xlsx').replace(/\.xlsx$/i, '');
      await exportToExcel(rows, `${base}-${stamp}.xlsx`);
    } catch (err) {
      alert('??? ?? ???????: ' + (err?.message ?? ''));
    } finally {
      setExporting(false);
    }
  }

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
            errors.push({ rowNum, message: res.reason?.message ?? '??? ??? ?????' });
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
          res = { success: false, error: err?.message ?? '??? ????' };
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
              errors.push({ rowNum: r.rowNum, message: e2?.message ?? '??? ??? ?????' });
              continue;
            }
            if (!r2?.success) {
              failed += 1;
              errors.push({ rowNum: r.rowNum, message: r2?.error || res?.error || '??? ?????????' });
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
      for (let i = 0; i < validResults.length; i++) {
        if (abortRef.current) break;
        const r = validResults[i];
        try {
          await createDailySalesSummary({ ...r.payload, companyId });
          succeeded++;
        } catch (err) {
          failed++;
          errors.push({ rowNum: r.rowNum, message: err?.message ?? '??? ??? ?????' });
        }
        setProgress({ current: i + 1, total, succeeded, failed, errors: [...errors], warnings: [...importWarnings] });
      }
    }

    setImporting(false);
    setPhase('done');
    if (succeeded > 0 && typeof onImportSuccess === 'function') onImportSuccess(succeeded);
  }

  async function handleDownloadErrorReport() {
    const rows = progress.errors.map((e) => ({ row: e.rowNum, message: e.message }));
    await exportToExcel(rows, 'import-errors.xlsx');
  }

  async function handleDownloadWarningsReport() {
    const list = progress.warnings || [];
    const rows = list.map((w) => ({ row: w.rowNum, message: w.message }));
    await exportToExcel(rows, 'import-warnings.xlsx');
  }

  async function handleDownloadValidationErrors() {
    const rows = validationResults
      .filter((r) => !r.valid || r.warnings.length > 0)
      .flatMap((r) => [
        ...r.errors.map((msg) => ({ row: r.rowNum, level: 'error', message: msg })),
        ...r.warnings.map((msg) => ({ row: r.rowNum, level: 'warning', message: msg })),
      ]);
    await exportToExcel(rows, 'validation-errors.xlsx');
  }

  const validCount = validationResults.filter((r) => r.valid).length;
  const errorCount = validationResults.filter((r) => !r.valid).length;
  const warnCount = validationResults.filter((r) => r.valid && r.warnings.length > 0).length;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const errorsToShow = showAllErrors ? validationResults.filter((r) => !r.valid || r.warnings.length > 0) : validationResults.filter((r) => !r.valid || r.warnings.length > 0).slice(0, 10);

  return (
    <AdaptiveSheet
      open={isOpen}
      onClose={() => { if (!importing) onClose(); }}
      title={`??????? ?????? ? ${cfg.label}`}
      size="xl"
      side="start"
      className="import-export-drawer"
      closeOnBackdrop={!importing}
    >
      {lookupsLoading && (
        <p className="text-[12px] text-noorix-muted mb-3">???? ????? ?????? ???????</p>
      )}

      <ScreenTabs
        className="mb-4"
        fadeWrap={false}
        items={sheetTabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content p-1 sm:p-4"
        animateContent={false}
      >
      {/* ?? EXPORT TAB ??????????????????????????????????????????????? */}
      {activeTab === 'export' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-2.5">
            <p className="m-0 text-[14px] text-noorix-muted leading-[1.6]">
              ??? ??? ??????? ?? ?????? ?? ????? ??? Excel ???? ????? ????? ?????. ?????? ??????? ?? ?????? ???????? (??? ??????) ?????? ???? ??????? ??? ???????.
            </p>
            {entityType === 'employees' && (
              <div className="mt-1">
                <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2 mt-0" >????? ??? ????????</p>
                <p className="m-0 text-[12px] text-noorix-muted leading-[1.65]">
                  {EMPLOYEE_EXPORT_COLUMNS_AR.join(' ? ')}
                </p>
              </div>
            )}
            <div className="flex gap-2.5 flex flex-wrap">
              <Button variant="primary" onClick={handleExport} disabled={exporting} loading={exporting}>
                {exporting ? '???? ????????' : '????? Excel'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ?? IMPORT TAB ???????????????????????????????????????????????? */}
      {activeTab === 'import' && (
        <div className="flex flex-col gap-[18px]">
          <ImportPhaseSteps phase={phase} importing={importing} />

          {phase !== 'done' && !importing && (
            <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
              <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2" >?????? 1 ? ????? ??????</p>
              <p className="m-0 text-[13px] text-noorix-muted leading-[1.6]">
                ???? ???? Excel ?????? ????? ?? Excel ?? Google Sheets? ??? ??????? ?? ?????.
                {entityType === 'invoices' && ' ????? ???????? ????????? ??? ?? ?????? ?? ??????? ??????? ?? ??????.'}
                {entityType === 'sales' && ' ????? ??????? ?????? ?? ????? ???????? ?? ?????.'}
                {entityType === 'employees' && ' ?????? ?? ?????: ????? ???????? ?? ?????????? (?????? ????). ???? ??????? ???????? ??????? ??????? ???????? ??????? ???? ???????? ?? ????? ?????.'}
              </p>
              <Button onClick={handleDownloadTemplate} disabled={lookupsLoading}>
                {lookupsLoading ? '??????' : '????? ???? Excel'}
              </Button>
            </div>
          )}

          {phase !== 'done' && !importing && (
            <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
              <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2" >?????? 2 ? ??? ?????</p>
              <div
                style={S.dropzone(dragging)}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="mb-2 text-[36px]"></div>
                <div className="text-[14px] font-semibold mb-1">
                  {phase === 'parsing' ? '???? ????? ??????' : '???? ??? Excel ??? ?? ???? ????????'}
                </div>
                <div className="text-[12px] text-noorix-muted">xlsx / xls / csv</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {parsedRows.length > 0 && (
                <div className="text-[13px] text-noorix-muted">
                  ? ?? ????? <strong>{parsedRows.length}</strong> ?? ?? ?????
                  {phase !== 'done' && (
                    <Button variant="ghost" size="sm" className="me-3" onClick={() => fileInputRef.current?.click()}>
                      ????? ?????
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === 'validated' && !importing && (
            <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
              <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2" >?????? 3 ? ????? ????? ?????????</p>
              <div className="flex flex-wrap gap-3">
                <StatBadge count={validCount} label="?? ????" color="#16a34a" />
                {errorCount > 0 && <StatBadge count={errorCount} label="??? ?????" color="var(--noorix-accent-red)" />}
                {warnCount > 0 && <StatBadge count={warnCount} label="???????" color="#f59e0b" />}
              </div>

              {entityType === 'employees' && validationResults.length > 0 && (
                <EmployeeImportPreviewTable validationResults={validationResults} parsedRows={parsedRows} />
              )}

              {(errorCount > 0 || warnCount > 0) && (
                <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
                  {errorsToShow.map((r) => (
                    <div key={r.rowNum}>
                      {r.errors.map((msg, j) => (
                        <div key={j} className="grid gap-2 rounded-lg text-[13px] grid-cols-[56px_1fr] items-start py-1.5 px-2.5 bg-[var(--noorix-red-7)]">
                          <span className="font-bold text-noorix-red">?? {r.rowNum}</span>
                          <span className="text-noorix-red">? {msg}</span>
                        </div>
                      ))}
                      {r.warnings.map((msg, j) => (
                        <div key={`w${j}`} className="grid gap-2 rounded-lg text-[12px] grid-cols-[56px_1fr] items-start py-[5px] px-[10px] bg-[var(--noorix-yellow-7)]">
                          <span className="font-bold text-noorix-amber">?? {r.rowNum}</span>
                          <span style={{ color: 'var(--noorix-accent-amber)' }}>? {msg}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {validationResults.filter((r) => !r.valid || r.warnings.length > 0).length > 10 && (
                    <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAllErrors(!showAllErrors)}>
                      {showAllErrors ? '??? ???' : `??? ???? (${validationResults.filter((r) => !r.valid || r.warnings.length > 0).length})`}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="self-start" onClick={handleDownloadValidationErrors}>
                    ????? ????? ?????
                  </Button>
                </div>
              )}

              {validCount === 0 ? (
                <div className="text-[14px] text-noorix-red font-semibold">
                  ?? ???? ???? ????? ?????????. ???? ?????? ??????? ?????? ??? ?????.
                </div>
              ) : (
                <Button variant="primary" className="self-start" onClick={handleImport}>
                  ??????? {validCount} ??{errorCount > 0 ? ` (???? ???? ${errorCount} ?? ?? ?????)` : ''}
                </Button>
              )}
            </div>
          )}

          {importing && (
            <div className="rounded-xl border border-noorix-border p-4 flex flex-col gap-3">
              <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2" >???? ??????????</p>
              <ProgressBar pct={pct} />
              <div className="flex items-center justify-between text-[13px] text-noorix-muted">
                <span>{progress.current} / {progress.total} ??</span>
                <span>{pct}%</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <StatBadge count={progress.succeeded} label="???" color="#16a34a" />
                {progress.failed > 0 && <StatBadge count={progress.failed} label="???" color="var(--noorix-accent-red)" />}
                {(progress.warnings || []).length > 0 && (
                  <StatBadge count={(progress.warnings || []).length} label="??????? ?? ??????" color="var(--noorix-accent-amber)" />
                )}
              </div>
              <Button variant="danger" size="sm" className="self-start" onClick={() => { abortRef.current = true; }}>
                ?????
              </Button>
            </div>
          )}

          {phase === 'done' && !importing && (
            <div className="rounded-xl p-4 flex flex-col gap-3" style={{ border: `1px solid ${progress.failed === 0 ? 'var(--noorix-accent-green)' : 'var(--color-noorix-amber)'}40` }}>
              <p className="text-[13px] font-bold text-noorix-muted uppercase tracking-[0.05em] mb-2" >????? ?????????</p>
              <div className="flex flex-wrap gap-3">
                <StatBadge count={progress.succeeded} label="?? ?????" color="#16a34a" />
                {progress.failed > 0 && <StatBadge count={progress.failed} label="???" color="var(--noorix-accent-red)" />}
                {(progress.warnings || []).length > 0 && (
                  <StatBadge count={(progress.warnings || []).length} label="???????" color="var(--noorix-accent-amber)" />
                )}
              </div>

              {(progress.warnings || []).length > 0 && (
                <div className="flex flex-col mt-2 gap-[5px] max-h-[200px] overflow-y-auto">
                  {(progress.warnings || []).slice(0, 20).map((w, i) => (
                    <div key={i} className="grid gap-2 rounded-lg text-[12px] grid-cols-[56px_1fr] items-start py-[5px] px-2.5 bg-[var(--noorix-yellow-7)]">
                      <span className="font-bold text-noorix-amber">?? {w.rowNum}</span>
                      <span style={{ color: 'var(--noorix-accent-amber)' }}>? {w.message}</span>
                    </div>
                  ))}
                  {(progress.warnings || []).length > 20 && (
                    <span className="text-[12px] text-noorix-muted">? ? {(progress.warnings || []).length - 20} ????? ???</span>
                  )}
                  <Button variant="ghost" size="sm" className="self-start" onClick={handleDownloadWarningsReport}>
                    ????? ????? ?????????
                  </Button>
                </div>
              )}

              {progress.errors.length > 0 && (
                <div className="flex flex-col gap-[5px] max-h-[200px] overflow-y-auto">
                  {progress.errors.slice(0, 20).map((e, i) => (
                    <div key={i} className="grid gap-2 rounded-lg text-[13px] grid-cols-[56px_1fr] items-start py-1.5 px-2.5 bg-[var(--noorix-red-7)]">
                      <span className="font-bold text-noorix-red">?? {e.rowNum}</span>
                      <span className="text-noorix-red">? {e.message}</span>
                    </div>
                  ))}
                  {progress.errors.length > 20 && (
                    <span className="text-[12px] text-noorix-muted">? ? {progress.errors.length - 20} ??? ???</span>
                  )}
                  <Button variant="ghost" size="sm" className="self-start" onClick={handleDownloadErrorReport}>
                    ????? ????? ???????
                  </Button>
                </div>
              )}

              <div className="flex gap-2.5">
                <Button variant="primary" onClick={onClose}>?????</Button>
                <Button onClick={() => { setPhase('idle'); setParsedRows([]); setValidationResults([]); setProgress({ current: 0, total: 0, succeeded: 0, failed: 0, errors: [], warnings: [] }); }}>
                  ??????? ??? ???
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </ScreenTabs>
    </AdaptiveSheet>
  );
}
