/**
 * OrdersImportModal — multi-phase professional import wizard
 * Phases: upload → parsing → preview → importing → done
 * Handles both products and categories with duplicate detection.
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { AdaptiveSheet, Button } from '../../../ui';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  importFromExcel,
  filterOrderProductsTemplateRows,
  filterOrderCategoriesTemplateRows,
  groupOrderProductImportRows,
  orderProductImportGroupsToPayload,
} from '../../../utils/exportUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowStatus = 'new' | 'duplicate' | 'invalid';
type Phase = 'upload' | 'parsing' | 'preview' | 'importing' | 'done';
type FilterType = 'all' | RowStatus;

interface ParsedRow {
  status: RowStatus;
  reason: string;
  nameAr: string;
  nameEn: string;
  category: string;
  variantsSummary: string;
  payload: Record<string, unknown> | null;
}

interface ImportResult {
  imported: number;
  skipped: number;
  invalid: number;
  error?: string;
}

interface Props {
  type: 'products' | 'categories';
  products: any[];
  categories: any[];
  createProductsBatch: any;
  createCategoriesBatch: any;
  onClose: () => void;
}

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-1 mb-5" aria-label="progress">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-[11px] whitespace-nowrap ${active ? 'text-noorix-primary font-semibold' : done ? 'text-noorix-primary' : 'text-noorix-muted'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors ${done ? 'bg-noorix-primary text-white' : active ? 'border-2 border-noorix-primary text-noorix-primary' : 'border border-noorix-border text-noorix-muted'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px transition-colors ${i < current ? 'bg-noorix-primary' : 'bg-noorix-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, label }: { status: RowStatus; label: string }) {
  const styles: Record<RowStatus, string> = {
    new: 'bg-green-50 border-green-200 text-green-700',
    duplicate: 'bg-amber-50 border-amber-200 text-amber-700',
    invalid: 'bg-red-50 border-red-200 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${styles[status]}`}>
      {label}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function OrdersImportModal({ type, products, categories, createProductsBatch, createCategoriesBatch, onClose }: Props) {
  const { t } = useTranslation();
  const isProducts = type === 'products';

  const [phase, setPhase] = useState<Phase>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Derived counts ──────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    total: rows.length,
    new: rows.filter(r => r.status === 'new').length,
    duplicate: rows.filter(r => r.status === 'duplicate').length,
    invalid: rows.filter(r => r.status === 'invalid').length,
  }), [rows]);

  const filteredRows = useMemo(() => (
    filter === 'all' ? rows : rows.filter(r => r.status === filter)
  ), [rows, filter]);

  const toImportCount = useMemo(() => (
    rows.filter(r => r.payload && (r.status === 'new' || (r.status === 'duplicate' && !skipDuplicates))).length
  ), [rows, skipDuplicates]);

  // ── File processing ─────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setParseError('');
    setPhase('parsing');
    try {
      const rawRows = await importFromExcel(file);
      let parsed: ParsedRow[] = [];

      if (!isProducts) {
        // ── Categories ─────────────────────────────────────────────────────
        const filtered = filterOrderCategoriesTemplateRows(rawRows);
        const existingNames = new Set(
          categories.map((c: any) => String(c.nameAr ?? '').trim().toLowerCase()),
        );
        parsed = filtered.map((r: any): ParsedRow => {
          const nameAr = String(r.nameAr ?? r.name_ar ?? '').trim();
          const nameEn = String(r.nameEn ?? r.name_en ?? '').trim();
          if (!nameAr) {
            return { status: 'invalid', reason: t('importReasonMissingNameAr'), nameAr: '—', nameEn, category: '', variantsSummary: '', payload: null };
          }
          if (existingNames.has(nameAr.toLowerCase())) {
            return { status: 'duplicate', reason: t('importReasonDuplicate'), nameAr, nameEn, category: '', variantsSummary: '', payload: { nameAr, nameEn: nameEn || undefined } };
          }
          return { status: 'new', reason: '', nameAr, nameEn, category: '', variantsSummary: '', payload: { nameAr, nameEn: nameEn || undefined } };
        });
      } else {
        // ── Products ────────────────────────────────────────────────────────
        const filtered = filterOrderProductsTemplateRows(rawRows);
        const catByName = new Map(
          categories.map((c: any) => [String(c.nameAr ?? '').trim().toLowerCase(), c.id]),
        );
        const existingNames = new Set(
          products.map((p: any) => String(p.nameAr ?? '').trim().toLowerCase()),
        );
        const groups = groupOrderProductImportRows(filtered);
        const payloads = orderProductImportGroupsToPayload(groups, catByName);
        const payloadMap = new Map(payloads.map((p: any) => [String(p.nameAr).trim().toLowerCase(), p]));

        parsed = groups.map((g: any): ParsedRow => {
          const nameAr = String(g.nameAr || (g.type === 'legacy' ? (g.row?.nameAr ?? '') : '')).trim();
          const nameEn = String(g.nameEn || (g.type === 'legacy' ? (g.row?.nameEn ?? '') : '') || '').trim();
          const category = String(g.category || (g.type === 'legacy' ? (g.row?.category ?? '') : '') || '').trim();

          if (!nameAr) {
            return { status: 'invalid', reason: t('importReasonMissingNameAr'), nameAr: '—', nameEn, category, variantsSummary: '', payload: null };
          }

          const payload = payloadMap.get(nameAr.toLowerCase()) ?? null;
          const variants: any[] = (payload as any)?.variants ?? [];
          const variantsSummary = variants.length > 0
            ? t('importVariants', String(variants.length))
            : '—';

          const catNameLower = category.trim().toLowerCase();
          const catWarning = catNameLower && !catByName.has(catNameLower)
            ? ` (${t('importReasonCategoryNotFound')}: "${category}")`
            : '';

          if (existingNames.has(nameAr.toLowerCase())) {
            return {
              status: 'duplicate',
              reason: t('importReasonDuplicate') + catWarning,
              nameAr, nameEn, category, variantsSummary, payload,
            };
          }
          return {
            status: 'new',
            reason: catWarning || '',
            nameAr, nameEn, category, variantsSummary, payload,
          };
        });
      }

      // Filter out completely empty rows (no nameAr, no data)
      parsed = parsed.filter(r => r.nameAr !== '' || r.nameEn !== '' || r.category !== '');

      if (parsed.length === 0) {
        setParseError(t('ordersImportNoValidRows'));
        setPhase('upload');
        return;
      }

      setRows(parsed);
      setFilter('all');
      setPhase('preview');
    } catch (e: any) {
      setParseError(e?.message || t('importFailed'));
      setPhase('upload');
    }
  }, [isProducts, products, categories, t]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  // ── Import execution ────────────────────────────────────────────────────────
  async function handleImport() {
    const toImport = rows.filter(
      r => r.payload && (r.status === 'new' || (r.status === 'duplicate' && !skipDuplicates)),
    );
    if (!toImport.length) return;

    setPhase('importing');
    const payloads = toImport.map(r => r.payload);
    const skipped = rows.filter(r => r.status === 'duplicate' && skipDuplicates).length;
    const invalid = counts.invalid;

    const onSuccess = (res: any) => {
      const importedData = res?.data ?? res;
      const imported = Array.isArray(importedData) ? importedData.length : (payloads.length);
      setResult({ imported, skipped, invalid });
      setPhase('done');
    };
    const onError = (err: any) => {
      setResult({ imported: 0, skipped, invalid, error: err?.message || t('importDoneError') });
      setPhase('done');
    };

    if (!isProducts) {
      createCategoriesBatch.mutate(payloads, { onSuccess, onError });
    } else {
      createProductsBatch.mutate(payloads, { onSuccess, onError });
    }
  }

  // ── Steps ───────────────────────────────────────────────────────────────────
  const stepLabels = [t('importStepUpload'), t('importStepPreview'), t('importStepImport')];
  const phaseToStep: Record<Phase, number> = {
    upload: 0, parsing: 0, preview: 1, importing: 2, done: 2,
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  function renderUpload() {
    return (
      <div className="flex flex-col gap-4">
        {parseError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 text-[12px]">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <span>{parseError}</span>
          </div>
        )}
        <div
          className={`
            border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer
            transition-all duration-150 select-none
            ${isDragging
              ? 'border-noorix-primary bg-noorix-primary/5 scale-[1.01]'
              : 'border-noorix-border hover:border-noorix-primary/60 hover:bg-noorix-bg-muted/60'
            }
          `}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        >
          <span className="text-4xl leading-none select-none">📥</span>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-noorix-text m-0 mb-1">{t('importDropZoneTitle')}</p>
            <p className="text-[12px] text-noorix-muted m-0">{t('importDropZoneOr')}</p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            {t('importChooseFile')}
          </Button>
          <p className="text-[11px] text-noorix-muted m-0">{t('importDropZoneHint')}</p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
        <p className="text-[11px] text-noorix-muted m-0 text-center">{t('importDropZoneNote')}</p>
      </div>
    );
  }

  function renderParsing() {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-[3px] border-noorix-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-noorix-muted m-0">{t('importParsing')}</p>
      </div>
    );
  }

  function renderPreview() {
    const filterOpts: { key: FilterType; label: string; count: number }[] = [
      { key: 'all', label: t('importFilterAll'), count: counts.total },
      { key: 'new', label: t('importFilterNew'), count: counts.new },
      { key: 'duplicate', label: t('importFilterDuplicate'), count: counts.duplicate },
      { key: 'invalid', label: t('importFilterInvalid'), count: counts.invalid },
    ];

    return (
      <div className="flex flex-col gap-4">
        {/* Summary pills */}
        <div className="flex flex-wrap gap-2">
          {counts.new > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-[12px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
              {counts.new} {t('importStatusNew')}
            </span>
          )}
          {counts.duplicate > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block flex-shrink-0" />
              {counts.duplicate} {t('importStatusDuplicate')}
            </span>
          )}
          {counts.invalid > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[12px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block flex-shrink-0" />
              {counts.invalid} {t('importStatusInvalid')}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-noorix-border overflow-x-auto">
          {filterOpts.map(({ key, label, count }) => {
            if (count === 0 && key !== 'all') return null;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`
                  px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0
                  ${filter === key
                    ? 'border-noorix-primary text-noorix-primary'
                    : 'border-transparent text-noorix-muted hover:text-noorix-text'
                  }
                `}
              >
                {label}
                <span className={`ms-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === key ? 'bg-noorix-primary/10' : 'bg-noorix-bg-muted'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview table */}
        <div className="overflow-auto rounded-lg border border-noorix-border" style={{ maxHeight: 320 }}>
          <table className="w-full text-[12px] border-collapse min-w-[480px]">
            <thead className="sticky top-0 bg-noorix-bg-muted z-10">
              <tr className="border-b border-noorix-border">
                <th className="py-2.5 px-3 text-start font-semibold text-noorix-muted w-24">{t('importColStatus')}</th>
                <th className="py-2.5 px-3 text-start font-semibold">{t('productNameAr')}</th>
                <th className="py-2.5 px-3 text-start font-semibold text-noorix-muted">{t('productNameEn')}</th>
                {isProducts && <th className="py-2.5 px-3 text-start font-semibold text-noorix-muted">{t('ordersCategories')}</th>}
                {isProducts && <th className="py-2.5 px-3 text-start font-semibold text-noorix-muted">{t('ordersProductVariants')}</th>}
                <th className="py-2.5 px-3 text-start font-semibold text-noorix-muted">{t('importColReason')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={isProducts ? 6 : 4} className="py-8 text-center text-noorix-muted text-[12px]">
                    {t('ordersNoSearchResults')}
                  </td>
                </tr>
              ) : filteredRows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-noorix-border last:border-0 transition-colors ${
                    row.status === 'invalid' ? 'bg-red-50/30' :
                    row.status === 'duplicate' ? 'bg-amber-50/20' : ''
                  }`}
                >
                  <td className="py-2 px-3">
                    <StatusBadge
                      status={row.status}
                      label={t(row.status === 'new' ? 'importStatusNew' : row.status === 'duplicate' ? 'importStatusDuplicate' : 'importStatusInvalid')}
                    />
                  </td>
                  <td className="py-2 px-3 font-medium max-w-[150px] truncate" title={row.nameAr}>{row.nameAr}</td>
                  <td className="py-2 px-3 text-noorix-muted max-w-[120px] truncate" title={row.nameEn}>{row.nameEn || '—'}</td>
                  {isProducts && <td className="py-2 px-3 text-noorix-muted max-w-[100px] truncate" title={row.category}>{row.category || '—'}</td>}
                  {isProducts && <td className="py-2 px-3 text-noorix-muted">{row.variantsSummary}</td>}
                  <td className="py-2 px-3 text-noorix-muted text-[11px] max-w-[160px]">
                    {row.reason ? (
                      <span className={row.status === 'invalid' ? 'text-red-600' : row.status === 'duplicate' ? 'text-amber-600' : 'text-noorix-muted'}>
                        {row.reason}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Duplicate option */}
        {counts.duplicate > 0 && (
          <label className="flex items-center gap-2.5 cursor-pointer text-[12px] text-noorix-text select-none w-fit">
            <input
              type="checkbox"
              checked={!skipDuplicates}
              onChange={(e) => setSkipDuplicates(!e.target.checked)}
              className="cursor-pointer w-3.5 h-3.5"
            />
            <span>{t('importOverwriteDuplicates')} <span className="text-noorix-muted">({counts.duplicate})</span></span>
          </label>
        )}

        {toImportCount === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 text-[12px]">
            {t('importNothingToImport')}
          </div>
        )}
      </div>
    );
  }

  function renderImporting() {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-[3px] border-noorix-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-noorix-muted m-0">{t('importingProgress', String(toImportCount))}</p>
      </div>
    );
  }

  function renderDone() {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-5">
        <span className="text-5xl leading-none select-none">{result?.error ? '❌' : '✅'}</span>
        <div className="text-center flex flex-col gap-1.5">
          <p className="text-[16px] font-semibold text-noorix-text m-0">{t('importDoneTitle')}</p>
          {result && (
            <div className="flex flex-col gap-1 text-[13px] mt-1">
              {result.imported > 0 && (
                <p className="text-green-700 m-0">✅ {t('importDoneImported', String(result.imported))}</p>
              )}
              {result.skipped > 0 && (
                <p className="text-amber-600 m-0">⏭ {t('importDoneSkipped', String(result.skipped))}</p>
              )}
              {result.invalid > 0 && (
                <p className="text-red-500 m-0">❌ {t('importDoneInvalid', String(result.invalid))}</p>
              )}
              {result.error && (
                <p className="text-red-600 m-0 text-[12px]">{result.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  function renderFooter() {
    if (phase === 'upload') {
      return (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        </div>
      );
    }
    if (phase === 'parsing' || phase === 'importing') return null;
    if (phase === 'preview') {
      return (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => { setPhase('upload'); setRows([]); }}>
            {t('importBackBtn')}
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={toImportCount === 0}
          >
            {t('importConfirmBtn', String(toImportCount))}
          </Button>
        </div>
      );
    }
    if (phase === 'done') {
      return (
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>{t('importCloseBtn')}</Button>
        </div>
      );
    }
    return null;
  }

  const title = isProducts ? t('importProductsTitle') : t('importCategoriesTitle');

  return (
    <AdaptiveSheet
      open
      onClose={phase === 'upload' || phase === 'done' ? onClose : undefined}
      title={
        <span className="flex items-center gap-2">
          <span className="text-base leading-none">📥</span>
          {title}
          {phase === 'preview' && (
            <span className="text-[11px] text-noorix-muted font-normal ms-1">
              — {t('importRowsFound', String(counts.total))}
            </span>
          )}
        </span>
      }
      size="lg"
      side="start"
      footer={renderFooter()}
    >
      {phase !== 'done' && (
        <StepIndicator steps={stepLabels} current={phaseToStep[phase]} />
      )}
      {phase === 'upload' && renderUpload()}
      {phase === 'parsing' && renderParsing()}
      {phase === 'preview' && renderPreview()}
      {phase === 'importing' && renderImporting()}
      {phase === 'done' && renderDone()}
    </AdaptiveSheet>
  );
}
