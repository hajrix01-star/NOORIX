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
import {
  addCustomSize,
  addCustomPackaging,
  getSizesOptions,
  getPackagingOptions,
} from '../constants/orderDefaults';
import {
  OrdersImportDone,
  OrdersImportFooter,
  OrdersImportPreview,
  OrdersImportProgress,
  StepIndicator,
} from './OrdersImportModalParts';

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
  sectionsSummary: string;
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
  /** أصناف الطلبات أو المبيعات — يُطبَّق على الاستيراد والتكرار */
  productType?: 'order' | 'sale';
  /** أقسام الشركة (بار، شيشة، مطبخ…) — للاختيار عند استيراد المبيعات */
  sections?: any[];
  companyId: string;
  products: any[];
  categories: any[];
  createProductsBatch: any;
  createCategoriesBatch: any;
  onClose: () => void;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function OrdersImportModal({
  type,
  productType = 'order',
  sections = [],
  companyId,
  products,
  categories,
  createProductsBatch,
  createCategoriesBatch,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const isProducts = type === 'products';
  const needsImportSections = isProducts && productType === 'sale';
  const scopedProducts = useMemo(
    () => (isProducts ? products.filter((p: any) => (p.productType || 'order') === productType) : products),
    [isProducts, products, productType],
  );
  const knownSectionNames = useMemo(
    () => (sections as any[]).map((s) => String(s.nameAr ?? '').trim()).filter(Boolean),
    [sections],
  );

  const [phase, setPhase] = useState<Phase>('upload');
  const [importSections, setImportSections] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState('');
  const [newCategoriesToCreate, setNewCategoriesToCreate] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Persists catByName across processFile → handleImport so new category IDs can be injected
  const catByNameRef = useRef<Map<string, string>>(new Map());

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

  const importSectionsOk = !needsImportSections || importSections.length > 0;

  function renderImportSectionsPicker() {
    if (!needsImportSections) return null;
    if (knownSectionNames.length === 0) {
      return (
        <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0">
          {t('importSectionsEmptyHint')}
        </p>
      );
    }
    return (
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-3">
        <div className="text-[13px] font-semibold text-noorix-text mb-1">{t('importChooseSections')}</div>
        <p className="text-[11px] text-noorix-muted m-0 mb-2">{t('importChooseSectionsHint')}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {knownSectionNames.map((nameAr) => (
            <label key={nameAr} className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input
                type="checkbox"
                checked={importSections.includes(nameAr)}
                onChange={(e) => {
                  setImportSections((prev) =>
                    e.target.checked ? [...new Set([...prev, nameAr])] : prev.filter((n) => n !== nameAr),
                  );
                }}
                className="cursor-pointer"
              />
              {nameAr}
            </label>
          ))}
        </div>
      </div>
    );
  }

  // ── File processing ─────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setParseError('');
    if (needsImportSections && importSections.length === 0) {
      setParseError(t('importSectionsRequired'));
      return;
    }
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
            return { status: 'invalid', reason: t('importReasonMissingNameAr'), nameAr: '—', nameEn, category: '', sectionsSummary: '', variantsSummary: '', payload: null };
          }
          if (existingNames.has(nameAr.toLowerCase())) {
            return { status: 'duplicate', reason: t('importReasonDuplicate'), nameAr, nameEn, category: '', sectionsSummary: '', variantsSummary: '', payload: { nameAr, nameEn: nameEn || undefined } };
          }
          return { status: 'new', reason: '', nameAr, nameEn, category: '', sectionsSummary: '', variantsSummary: '', payload: { nameAr, nameEn: nameEn || undefined } };
        });
      } else {
        // ── Products ────────────────────────────────────────────────────────
        const filtered = filterOrderProductsTemplateRows(rawRows, productType);
        const catByName = new Map(
          categories.map((c: any) => [String(c.nameAr ?? '').trim().toLowerCase(), c.id]),
        );
        catByNameRef.current = catByName;

        const existingNames = new Set(
          scopedProducts.map((p: any) => String(p.nameAr ?? '').trim().toLowerCase()),
        );
        const groups = groupOrderProductImportRows(filtered);
        const payloads = orderProductImportGroupsToPayload(groups, catByName, productType, {
          knownSectionNames,
          defaultSections: importSections,
        });
        const payloadMap = new Map(payloads.map((p: any) => [String(p.nameAr).trim().toLowerCase(), p]));

        // Collect unique category names that need to be created
        const missingCatNames = new Map<string, string>(); // lower → original case

        parsed = groups.map((g: any): ParsedRow => {
          const nameAr = String(g.nameAr || (g.type === 'legacy' ? (g.row?.nameAr ?? '') : '')).trim();
          const nameEn = String(g.nameEn || (g.type === 'legacy' ? (g.row?.nameEn ?? '') : '') || '').trim();
          const category = String(g.category || (g.type === 'legacy' ? (g.row?.category ?? '') : '') || '').trim();

          if (!nameAr) {
            return { status: 'invalid', reason: t('importReasonMissingNameAr'), nameAr: '—', nameEn, category, sectionsSummary: '', variantsSummary: '', payload: null };
          }

          const payload = payloadMap.get(nameAr.toLowerCase()) ?? null;
          const variants: any[] = (payload as any)?.variants ?? [];
          const variantsSummary = variants.length > 0
            ? t('importVariants', String(variants.length))
            : '—';
          const rowSections: string[] = (payload as any)?.sections ?? [];
          const sectionsSummary = rowSections.length > 0 ? rowSections.join(' · ') : '—';

          const catNameLower = category.trim().toLowerCase();
          let catNote = '';
          if (catNameLower && !catByName.has(catNameLower)) {
            missingCatNames.set(catNameLower, category.trim());
            catNote = t('importReasonCategoryWillBeCreated');
          }

          if (needsImportSections && rowSections.length === 0) {
            return {
              status: 'invalid',
              reason: t('importReasonMissingSection'),
              nameAr,
              nameEn,
              category,
              sectionsSummary,
              variantsSummary,
              payload: null,
            };
          }

          if (existingNames.has(nameAr.toLowerCase())) {
            return {
              status: 'duplicate',
              reason: t('importReasonDuplicate') + (catNote ? ` — ${catNote}` : ''),
              nameAr, nameEn, category, sectionsSummary, variantsSummary, payload,
            };
          }
          return {
            status: 'new',
            reason: catNote,
            nameAr, nameEn, category, sectionsSummary, variantsSummary, payload,
          };
        });

        setNewCategoriesToCreate(Array.from(missingCatNames.values()));
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
  }, [isProducts, productType, needsImportSections, importSections, knownSectionNames, scopedProducts, categories, t]);

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
    if (needsImportSections && importSections.length === 0) {
      setParseError(t('importSectionsRequired'));
      setPhase('preview');
      return;
    }

    setPhase('importing');
    const skipped = rows.filter(r => r.status === 'duplicate' && skipDuplicates).length;
    const invalid = counts.invalid;

    try {
      // ── Step 1: auto-create missing categories (products only) ─────────────
      if (isProducts && newCategoriesToCreate.length > 0) {
        const newCatPayloads = newCategoriesToCreate.map(nameAr => ({ nameAr }));
        const catRes: any = await new Promise((resolve, reject) => {
          createCategoriesBatch.mutate(newCatPayloads, { onSuccess: resolve, onError: reject });
        });
        // Inject new IDs into catByNameRef so product payloads can reference them
        const created: any[] = catRes?.data ?? catRes ?? [];
        for (const cat of created) {
          const key = String(cat.nameAr ?? '').trim().toLowerCase();
          if (key && cat.id) catByNameRef.current.set(key, cat.id);
        }
      }

      // ── Step 2: build final product payloads (inject newly created categoryIds) ──
      let payloads: any[];
      if (isProducts) {
        payloads = toImport.map(r => {
          const catKey = String(r.category ?? '').trim().toLowerCase();
          const resolvedCatId = catKey ? catByNameRef.current.get(catKey) : undefined;
          const payloadSections = (r.payload as any)?.sections as string[] | undefined;
          const sections =
            payloadSections && payloadSections.length > 0 ? payloadSections : importSections;
          const base = { ...r.payload, productType, sections };
          return resolvedCatId ? { ...base, categoryId: resolvedCatId } : base;
        });
      } else {
        payloads = toImport.map(r => r.payload);
      }

      // ── Step 3: create items ────────────────────────────────────────────────
      const mutation = isProducts ? createProductsBatch : createCategoriesBatch;
      const itemRes: any = await new Promise((resolve, reject) => {
        mutation.mutate(payloads, { onSuccess: resolve, onError: reject });
      });
      const importedData = itemRes?.data ?? itemRes;
      const imported = Array.isArray(importedData) ? importedData.length : payloads.length;

      // ── Step 4: persist new sizes & packaging into localStorage ────────────
      if (isProducts && companyId) {
        const existingSizes = new Set(
          getSizesOptions(companyId).map((s: any) => String(s.ar ?? '').trim().toLowerCase()),
        );
        const existingPkg = new Set(
          getPackagingOptions(companyId).map((s: any) => String(s.ar ?? '').trim().toLowerCase()),
        );
        for (const p of payloads) {
          for (const v of (p as any)?.variants ?? []) {
            const size = String(v.size ?? '').trim();
            if (size && !existingSizes.has(size.toLowerCase())) {
              addCustomSize(companyId, size, '');
              existingSizes.add(size.toLowerCase());
            }
            const pkg = String(v.packaging ?? '').trim();
            if (pkg && !existingPkg.has(pkg.toLowerCase())) {
              addCustomPackaging(companyId, pkg, '');
              existingPkg.add(pkg.toLowerCase());
            }
          }
        }
      }

      setResult({ imported, skipped, invalid });
      setPhase('done');
    } catch (err: any) {
      setResult({ imported: 0, skipped, invalid, error: err?.message || t('importDoneError') });
      setPhase('done');
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
        {renderImportSectionsPicker()}
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
    return <OrdersImportProgress label={t('importParsing')} />;
  }

  function renderPreview() {
    return (
      <OrdersImportPreview
        t={t}
        isProducts={isProducts}
        needsImportSections={needsImportSections}
        importSectionsNode={renderImportSectionsPicker()}
        counts={counts}
        newCategoriesToCreate={newCategoriesToCreate}
        filter={filter}
        setFilter={setFilter}
        filteredRows={filteredRows}
        skipDuplicates={skipDuplicates}
        setSkipDuplicates={setSkipDuplicates}
        toImportCount={toImportCount}
      />
    );
  }

  function renderImporting() {
    return <OrdersImportProgress label={t('importingProgress', String(toImportCount))} />;
  }

  function renderDone() {
    return <OrdersImportDone result={result} t={t} />;
  }
  function renderFooter() {
    return (
      <OrdersImportFooter
        phase={phase}
        onClose={onClose}
        onBack={() => { setPhase('upload'); setRows([]); setNewCategoriesToCreate([]); }}
        onImport={handleImport}
        toImportCount={toImportCount}
        importSectionsOk={importSectionsOk}
        t={t}
      />
    );
  }
  const title = isProducts
    ? productType === 'sale'
      ? t('importSaleProductsTitle')
      : t('importProductsTitle')
    : t('importCategoriesTitle');

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
