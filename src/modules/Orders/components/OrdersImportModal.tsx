/**
 * OrdersImportModal - multi-phase professional import wizard.
 * Handles both products and categories with duplicate detection.
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { AdaptiveSheet, Checkbox } from '../../../ui';
import { useTranslation } from '../../../i18n/useTranslation';
import { importFromExcel } from '../../../utils/exportUtils';
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
import { OrdersImportUpload } from './OrdersImportUpload';
import {
  errorMessage,
  knownOrderSectionNames,
  mutationCreatedCount,
  mutationCreatedItems,
  parseOrdersImportRows,
  productPayloadSections,
  productPayloadVariants,
  requirePayload,
  type BatchMutation,
  type FilterType,
  type ImportResult,
  type ParsedRow,
  type Phase,
} from './OrdersImportModalModel';
import type {
  OrderCategory,
  OrderCategoryPayload,
  OrderProduct,
  OrderProductPayload,
  OrderProductType,
  OrderSection,
  OrderCatalogBatchCreateResult,
  ApiParsedResult,
} from '../../../types/api';


interface Props {
  type: 'products' | 'categories';
  productType?: OrderProductType;
  sections?: OrderSection[];
  companyId: string;
  products: OrderProduct[];
  categories: OrderCategory[];
  createProductsBatch: BatchMutation<OrderProductPayload>;
  createCategoriesBatch: BatchMutation<OrderCategoryPayload>;
  onClose: () => void;
}

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
    () => (isProducts ? products.filter((product) => (product.productType || 'order') === productType) : products),
    [isProducts, products, productType],
  );
  const knownSectionNames = useMemo(() => knownOrderSectionNames(sections), [sections]);

  const [phase, setPhase] = useState<Phase>('upload');
  const [importSections, setImportSections] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState('');
  const [newCategoriesToCreate, setNewCategoriesToCreate] = useState<string[]>([]);
  // Persists category IDs across parsing and importing so new categories can be injected.
  const catByNameRef = useRef<Map<string, string>>(new Map());
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
            <Checkbox
                key={nameAr}
                checked={importSections.includes(nameAr)}
                onChange={(e) => {
                  setImportSections((prev) =>
                    e.target.checked ? [...new Set([...prev, nameAr])] : prev.filter((n) => n !== nameAr),
                  );
                }}
                label={nameAr}
                className="cursor-pointer"
                containerClassName="text-[12px] cursor-pointer"
              />
          ))}
        </div>
      </div>
    );
  }
  const processFile = useCallback(async (file: File) => {
    setParseError('');
    if (needsImportSections && importSections.length === 0) {
      setParseError(t('importSectionsRequired'));
      return;
    }

    setPhase('parsing');
    try {
      const rawRows = await importFromExcel(file);
      const parsed = parseOrdersImportRows({
        rawRows,
        isProducts,
        productType,
        needsImportSections,
        importSections,
        knownSectionNames,
        scopedProducts,
        categories,
        t,
      });

      catByNameRef.current = parsed.categoryByName;
      setNewCategoriesToCreate(parsed.newCategoriesToCreate);

      if (parsed.rows.length === 0) {
        setParseError(t('ordersImportNoValidRows'));
        setPhase('upload');
        return;
      }

      setRows(parsed.rows);
      setFilter('all');
      setPhase('preview');
    } catch (error) {
      setParseError(errorMessage(error, t('importFailed')));
      setPhase('upload');
    }
  }, [isProducts, productType, needsImportSections, importSections, knownSectionNames, scopedProducts, categories, t]);

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
      if (isProducts && newCategoriesToCreate.length > 0) {
        const newCatPayloads = newCategoriesToCreate.map(nameAr => ({ nameAr }));
        const catRes = await new Promise<ApiParsedResult<OrderCatalogBatchCreateResult>>((resolve, reject) => {
          createCategoriesBatch.mutate(newCatPayloads, { onSuccess: resolve, onError: reject });
        });
        if (!catRes.success) {
          throw new Error(catRes.error || t('importDoneError'));
        }
        for (const cat of mutationCreatedItems(catRes)) {
          const key = String(cat.nameAr ?? '').trim().toLowerCase();
          if (key && cat.id) catByNameRef.current.set(key, cat.id);
        }
      }
      let payloads: Array<OrderProductPayload | OrderCategoryPayload>;
      if (isProducts) {
        payloads = toImport.map((r) => {
          const payload = requirePayload(r.payload);
          const catKey = String(r.category ?? '').trim().toLowerCase();
          const resolvedCatId = catKey ? catByNameRef.current.get(catKey) : undefined;
          const payloadSections = productPayloadSections(payload);
          const sections =
            payloadSections && payloadSections.length > 0 ? payloadSections : importSections;
          const base = { ...payload, productType, sections };
          return resolvedCatId ? { ...base, categoryId: resolvedCatId } : base;
        });
      } else {
        payloads = toImport.map((r) => requirePayload(r.payload));
      }
      const itemRes = isProducts
        ? await new Promise<ApiParsedResult<OrderCatalogBatchCreateResult>>((resolve, reject) => {
            createProductsBatch.mutate(payloads as OrderProductPayload[], { onSuccess: resolve, onError: reject });
          })
        : await new Promise<ApiParsedResult<OrderCatalogBatchCreateResult>>((resolve, reject) => {
            createCategoriesBatch.mutate(payloads as OrderCategoryPayload[], { onSuccess: resolve, onError: reject });
          });
      if (!itemRes.success) {
        throw new Error(itemRes.error || t('importDoneError'));
      }
      const imported = mutationCreatedCount(itemRes, payloads.length);
      if (isProducts && companyId) {
        const existingSizes = new Set(
          getSizesOptions(companyId).map((option) => String(option.ar ?? '').trim().toLowerCase()),
        );
        const existingPkg = new Set(
          getPackagingOptions(companyId).map((option) => String(option.ar ?? '').trim().toLowerCase()),
        );
        for (const payload of payloads) {
          for (const v of productPayloadVariants(payload)) {
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
    } catch (error) {
      setResult({ imported: 0, skipped, invalid, error: errorMessage(error, t('importDoneError')) });
      setPhase('done');
    }
  }
  const stepLabels = [t('importStepUpload'), t('importStepPreview'), t('importStepImport')];
  const phaseToStep: Record<Phase, number> = {
    upload: 0, parsing: 0, preview: 1, importing: 2, done: 2,
  };
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
          <span className="text-base leading-none"></span>
          {title}
          {phase === 'preview' && (
            <span className="text-[11px] text-noorix-muted font-normal ms-1">
              - {t('importRowsFound', String(counts.total))}
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
      {phase === 'upload' && (
        <OrdersImportUpload
          t={t}
          importSectionsNode={renderImportSectionsPicker()}
          parseError={parseError}
          onFile={processFile}
        />
      )}
      {phase === 'parsing' && renderParsing()}
      {phase === 'preview' && renderPreview()}
      {phase === 'importing' && renderImporting()}
      {phase === 'done' && renderDone()}
    </AdaptiveSheet>
  );
}
