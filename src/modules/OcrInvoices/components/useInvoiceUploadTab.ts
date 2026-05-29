import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';
import { getSaudiToday } from '../../../utils/saudiDate';
import { getVaults } from '../../../services/api';
import {
  createOcrSupplier,
  extractInvoice,
  getOcrAccountingSupplierSuggestions,
  saveOcrInvoice,
} from '../services/ocrApi';
import { revokePreviewUrl } from './invoiceUpload/ocrInvoiceUploadUtils';
import { buildOcrSavePayload, validateOcrLinkedPurchaseInput } from './invoiceUpload/ocrInvoiceUploadPayload';
import {
  useAutoPickTopAccountingSupplier,
  usePrefillOcrInvoiceFromId,
  useResetAccountingUserTouchOnSuggestKey,
} from './invoiceUpload/useInvoiceUploadReactQueryEffects';
import { useOcrInvoiceImagePipeline } from './invoiceUpload/useOcrInvoiceImagePipeline';
import { useOcrInvoiceLineItems } from './invoiceUpload/useOcrInvoiceLineItems';
import { vaultKeys, ocrKeys } from '../../../services/queryKeys';

/**
 * منطق تبويب رفع/استخراج فاتورة OCR (منفصل عن العرض)
 */
export function useInvoiceUploadTab({ onSaved, prefillInvoiceId, onPrefillConsumed, suppliers = [], items = [] }: any) {
  const { t, lang: language } = useTranslation();
  const { activeCompanyId } = useApp();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [imageBase64, setBase64] = useState<any>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [extracted, setExtracted] = useState<any>(null);
  const [editItems, setEditItems] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);
  const [extractWarning, setExtractWarning] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [extractStartedAt, setExtractStartedAt] = useState<number | null>(null);
  const [extractFailureStage, setExtractFailureStage] = useState<'request' | 'parse' | null>(null);
  const [extractStageDurations, setExtractStageDurations] = useState<{
    uploadReadyMs: number | null;
    modelRequestMs: number | null;
    jsonValidationMs: number | null;
    enrichmentMs: number | null;
    readyForReviewMs: number | null;
  }>({
    uploadReadyMs: null,
    modelRequestMs: null,
    jsonValidationMs: null,
    enrichmentMs: null,
    readyForReviewMs: null,
  });
  const [extractIssueReport, setExtractIssueReport] = useState('');
  const [issueCopied, setIssueCopied] = useState(false);
  const [finalizeOcrId, setFinalizeOcrId] = useState<any>(null);
  const [prefillOcrSupplierId, setPrefillOcrSupplierId] = useState<any>(null);
  const [createLinkedPurchase, setCreateLinkedPurchase] = useState(false);
  const [transactionDate, setTransactionDate] = useState(() => getSaudiToday());
  const [accountingSupplierId, setAccountingSupplierId] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [purchaseSupplierInvoiceNumber, setPurchaseSupplierInvoiceNumber] = useState('');
  const [isPurchaseTaxable, setIsPurchaseTaxable] = useState(true);
  const [prefillLinkedPurchase, setPrefillLinkedPurchase] = useState<any>(null);
  const [postSaveLinkedPurchase, setPostSaveLinkedPurchase] = useState<any>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const autoExtractedImageRef = useRef<string | null>(null);
  const userTouchedAccountingRef = useRef(false);
  const [newOcrSupplierOpen, setNewOcrSupplierOpen] = useState(false);
  const [newOcrNameAr, setNewOcrNameAr] = useState('');
  const [newOcrTax, setNewOcrTax] = useState('');
  const [newOcrSaving, setNewOcrSaving] = useState(false);
  const [newOcrError, setNewOcrError] = useState<any>(null);

  const { activeItems, warningCount, updateItem, applyMathSuggestion, updateItemMatch } = useOcrInvoiceLineItems(
    extracted,
    editItems,
    setEditItems,
  );
  const { readFile } = useOcrInvoiceImagePipeline(
    setPreview,
    setBase64,
    setMimeType,
    setExtracted,
    setFinalizeOcrId,
    setPrefillLinkedPurchase,
    setPostSaveLinkedPurchase,
    setPrefillOcrSupplierId,
    setCreateLinkedPurchase,
    setAccountingSupplierId,
    setVaultId,
    setPurchaseSupplierInvoiceNumber,
    setTransactionDate,
    setError,
    setSuccess,
  );

  const canCreatePurchase = useMemo(() => {
    const role = user?.role;
    const perms = user?.permissions;
    return (
      hasPermission(role, PERMISSIONS.PURCHASES_WRITE, perms) ||
      hasPermission(role, PERMISSIONS.INVOICES_WRITE, perms)
    );
  }, [user?.role, user?.permissions]);

  const supplierNameForSuggest = (extracted?.supplier?.name || '').trim().slice(0, 120);
  const invoiceVatDigits = useMemo(
    () => String(extracted?.vatNumber?.value ?? '').replace(/\D/g, ''),
    [extracted?.vatNumber?.value],
  );
  const invoiceVatRaw = useMemo(
    () => String(extracted?.vatNumber?.value ?? '').trim(),
    [extracted?.vatNumber?.value],
  );
  const accSuggestKey = `${finalizeOcrId || ''}|${prefillOcrSupplierId || ''}|${supplierNameForSuggest}|${invoiceVatDigits}`;

  const { data: vaultRows = [] } = useQuery({
    queryKey: vaultKeys.ocrFinalize(activeCompanyId || ''),
    enabled: !!activeCompanyId && !!finalizeOcrId && createLinkedPurchase && canCreatePurchase,
    queryFn: async () => {
      const r = await getVaults(activeCompanyId, false);
      return r.success && Array.isArray(r.data) ? r.data : [];
    },
  });

  const { data: accSuggestions = [], isFetching: accSuggestionsFetching } = useQuery({
    queryKey: ocrKeys.accountingSupplierSuggestions(
      activeCompanyId || '',
      prefillOcrSupplierId || '',
      supplierNameForSuggest,
      invoiceVatDigits,
    ),
    enabled:
      !!activeCompanyId &&
      !!finalizeOcrId &&
      !!extracted &&
      canCreatePurchase &&
      (!!prefillOcrSupplierId || supplierNameForSuggest.length >= 1 || invoiceVatDigits.length >= 9),
    queryFn: async () => {
      const q = supplierNameForSuggest.length >= 1 ? supplierNameForSuggest : undefined;
      const r = await getOcrAccountingSupplierSuggestions({
        ...(prefillOcrSupplierId ? { ocrSupplierId: prefillOcrSupplierId } : {}),
        ...(q ? { q } : {}),
        ...(invoiceVatDigits.length >= 9
          ? { invoiceVat: invoiceVatRaw || invoiceVatDigits }
          : {}),
        limit: 24,
      });
      return r.success && Array.isArray(r.data) ? r.data : [];
    },
  });

  useResetAccountingUserTouchOnSuggestKey(accSuggestKey, userTouchedAccountingRef);
  useAutoPickTopAccountingSupplier({
    accSuggestions,
    accSuggestKey,
    finalizeOcrId,
    canCreatePurchase,
    invoiceVatDigits,
    userTouchedAccountingRef,
    setAccountingSupplierId,
  });
  usePrefillOcrInvoiceFromId({
    prefillInvoiceId,
    onPrefillConsumed,
    language,
    activeCompanyId,
    queryClient,
    t,
    setError,
    setExtracted,
    setEditItems,
    setFinalizeOcrId,
    setPrefillLinkedPurchase,
    setPrefillOcrSupplierId,
    setPurchaseSupplierInvoiceNumber,
    setTransactionDate,
    setCreateLinkedPurchase,
    setAccountingSupplierId,
    setVaultId,
    setPreview,
    setBase64,
    setMimeType,
    setPrefillLoading,
  });

  const handleDrop = useCallback(
    (e: any) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      readFile(file);
    },
    [readFile],
  );

  const handleExtract = useCallback(async () => {
    if (!imageBase64) return;
    const startedAt = Date.now();
    setExtractStartedAt(startedAt);
    setExtractFailureStage(null);
    setExtractIssueReport('');
    setIssueCopied(false);
    setExtractStageDurations({
      uploadReadyMs: 0,
      modelRequestMs: null,
      jsonValidationMs: null,
      enrichmentMs: null,
      readyForReviewMs: null,
    });
    setLoading(true);
    setError(null);
    setExtractWarning(null);
    try {
      const requestStartedAt = Date.now();
      const res = await extractInvoice(imageBase64, mimeType);
      const modelRequestMs = Math.max(1, Date.now() - requestStartedAt);
      if (res.success) {
        if (res.data?.parseError) {
          const parseStartedAt = Date.now();
          setExtractFailureStage('parse');
          const debugRaw = res.data || {};
          const modelAttempts = Array.isArray(debugRaw.modelAttempts) ? debugRaw.modelAttempts : [];
          const schemaIssues = Array.isArray(debugRaw.schemaIssues) ? debugRaw.schemaIssues : [];
          const issueReport = [
            `OCR Pipeline Failure`,
            `stage=parse_validation`,
            `friendlyError=${t('ocrParseFriendlyError')}`,
            `errorDetail=${String(debugRaw.errorDetail || 'parse_or_schema_failed')}`,
            `rawTextSnippet=${String(debugRaw.rawText || '').slice(0, 400)}`,
            schemaIssues.length ? `schemaIssues=${schemaIssues.join(' | ')}` : null,
            `modelAttempts=${JSON.stringify(modelAttempts)}`,
            `clientElapsedMs=${Date.now() - startedAt}`,
          ].filter(Boolean).join('\n');
          setExtractIssueReport(issueReport);
          setExtractStageDurations({
            uploadReadyMs: 0,
            modelRequestMs,
            jsonValidationMs: Math.max(1, Date.now() - parseStartedAt),
            enrichmentMs: null,
            readyForReviewMs: null,
          });
          setError(t('ocrParseFriendlyError'));
        } else {
          const parseStartedAt = Date.now();
          const parseAndNormalizeMs = Math.max(1, Date.now() - parseStartedAt);
          const telemetry = res.data && typeof res.data === 'object' ? res.data : {};
          const extractionLatencyMs = Number((telemetry as { extractionLatencyMs?: number }).extractionLatencyMs) || 0;
          const modelAttempts = Array.isArray((telemetry as { modelAttempts?: unknown[] }).modelAttempts)
            ? (telemetry as { modelAttempts: Array<{ latencyMs?: number }> }).modelAttempts
            : [];
          const modelAttemptsMs = modelAttempts.reduce((sum, attempt) => {
            const latency = Number(attempt?.latencyMs);
            return sum + (Number.isFinite(latency) && latency > 0 ? latency : 0);
          }, 0);
          const processingOverheadMs = Math.max(0, extractionLatencyMs - modelAttemptsMs);
          const jsonValidationMs = Math.max(1, Math.round(processingOverheadMs * 0.4) || parseAndNormalizeMs);
          const enrichmentMs = Math.max(1, Math.round(processingOverheadMs * 0.6) || 1);

          setExtractStageDurations({
            uploadReadyMs: 0,
            modelRequestMs,
            jsonValidationMs,
            enrichmentMs,
            readyForReviewMs: 0,
          });
          setExtracted(res.data);
          setEditItems(null);
          if (res.data?.enrichError) {
            setExtractWarning(t('ocrEnrichWarning'));
          }
        }
      } else {
        setExtractFailureStage('request');
        const requestError = res.error || t('ocrExtractFailed');
        setExtractStageDurations((prev) => ({ ...prev, modelRequestMs }));
        setExtractIssueReport([
          'OCR Pipeline Failure',
          'stage=model_request',
          `error=${String(requestError)}`,
          `clientElapsedMs=${Date.now() - startedAt}`,
        ].join('\n'));
        setError(requestError);
      }
    } catch (err: any) {
      setExtractFailureStage('request');
      const msg = err?.message || t('ocrExtractFailed');
      setExtractIssueReport([
        'OCR Pipeline Failure',
        'stage=model_request',
        `error=${String(msg)}`,
        `clientElapsedMs=${Date.now() - startedAt}`,
      ].join('\n'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [imageBase64, mimeType, t]);

  const handleCopyIssueReport = useCallback(async () => {
    if (!extractIssueReport.trim()) return;
    try {
      await navigator.clipboard.writeText(extractIssueReport);
      setIssueCopied(true);
      window.setTimeout(() => setIssueCopied(false), 1800);
    } catch {
      setIssueCopied(false);
    }
  }, [extractIssueReport]);

  useEffect(() => {
    if (!imageBase64 || extracted || loading || prefillLoading) return;
    if (autoExtractedImageRef.current === imageBase64) return;
    autoExtractedImageRef.current = imageBase64;
    void handleExtract();
  }, [imageBase64, extracted, loading, prefillLoading, handleExtract]);

  useEffect(() => {
    if (!imageBase64) {
      autoExtractedImageRef.current = null;
      setExtractStartedAt(null);
      setExtractFailureStage(null);
      setExtractIssueReport('');
      setExtractStageDurations({
        uploadReadyMs: null,
        modelRequestMs: null,
        jsonValidationMs: null,
        enrichmentMs: null,
        readyForReviewMs: null,
      });
    }
  }, [imageBase64]);

  const handleSupplierMatchChange = useCallback(
    (supplierId: string) => {
      const id = String(supplierId || '').trim();
      if (!id) {
        setExtracted((prev: any) => (prev ? { ...prev, supplierMatch: null } : prev));
        setPrefillOcrSupplierId(null);
        return;
      }
      const picked = (suppliers || []).find((s: any) => s.id === id);
      if (!picked) return;
      setExtracted((prev: any) =>
        prev
          ? {
              ...prev,
              supplierMatch: {
                id: picked.id,
                nameAr: picked.nameAr,
                score: 1,
                status: 'review',
              },
            }
          : prev,
      );
      setPrefillOcrSupplierId(picked.id);
    },
    [suppliers],
  );

  const handleItemMatchChange = useCallback(
    (index: number, itemId: string) => {
      const id = String(itemId || '').trim();
      if (!id) {
        updateItemMatch(index, null);
        return;
      }
      const picked = (items || []).find((x: any) => x.id === id);
      if (!picked) return;
      updateItemMatch(index, {
        id: picked.id,
        nameAr: picked.nameAr,
        nameEn: picked.nameEn ?? null,
        hasSizes: !!picked.hasSizes,
        score: 1,
        status: 'review',
      });
    },
    [items, updateItemMatch],
  );

  const handleSave = async () => {
    if (!extracted) return;
    const ve = validateOcrLinkedPurchaseInput({
      language,
      createLinkedPurchase,
      finalizeOcrId,
      canCreatePurchase,
      accountingSupplierId,
      vaultId,
      transactionDate,
      isPurchaseTaxable,
      purchaseSupplierInvoiceNumber,
      extracted,
    });
    if (ve) {
      setError(ve);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildOcrSavePayload({
        extracted,
        activeItems,
        preview,
        finalizeOcrId,
        createLinkedPurchase,
        canCreatePurchase,
        accountingSupplierId,
        transactionDate,
        vaultId,
        isPurchaseTaxable,
        purchaseSupplierInvoiceNumber,
      });
      const res = await saveOcrInvoice(payload);
      if (res.success) {
        const lp = res.data?.linkedPurchaseInvoice;
        const hasLedgerLink = !!(lp?.id || res.data?.linkedPurchaseInvoiceId);
        setSuccess(true);
        onSaved?.({ invalidateFinancial: hasLedgerLink });
        setPostSaveLinkedPurchase(lp?.id ? lp : null);
        const delayMs = hasLedgerLink ? 7000 : 2000;
        setTimeout(() => {
          setPreview((prev: any) => {
            revokePreviewUrl(prev);
            return null;
          });
          setBase64(null);
          setExtracted(null);
          setEditItems(null);
          setFinalizeOcrId(null);
          setPrefillOcrSupplierId(null);
          setPrefillLinkedPurchase(null);
          setPostSaveLinkedPurchase(null);
          setCreateLinkedPurchase(false);
          setAccountingSupplierId('');
          setVaultId('');
          setPurchaseSupplierInvoiceNumber('');
          setTransactionDate(getSaudiToday());
          setExtractWarning(null);
          setSuccess(false);
        }, delayMs);
      } else {
        setError(res.error || t('ocrExtractFailed'));
      }
    } catch {
      setError(t('ocrExtractFailed'));
    } finally {
      setSaving(false);
    }
  };

  const openNewOcrSupplierModal = () => {
    setNewOcrNameAr(String(extracted?.supplier?.name || '').trim());
    setNewOcrTax(invoiceVatRaw || '');
    setNewOcrError(null);
    setNewOcrSupplierOpen(true);
  };

  const handleSubmitNewOcrSupplier = async () => {
    const name = newOcrNameAr.trim();
    if (!name) {
      setNewOcrError(language === 'ar' ? 'أدخل الاسم بالعربية.' : 'Enter Arabic name.');
      return;
    }
    setNewOcrSaving(true);
    setNewOcrError(null);
    try {
      const taxDigits = newOcrTax.replace(/\D/g, '');
      const tax = taxDigits.length >= 9 ? newOcrTax.trim() : undefined;
      const r = await createOcrSupplier({
        nameAr: name,
        ...(tax ? { taxNumber: tax } : {}),
        ...(accountingSupplierId ? { accountingSupplierId } : {}),
      });
      if (!r.success || !r.data?.id) {
        setNewOcrError(r.error || t('ocrExtractFailed'));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ocrKeys.suppliers(activeCompanyId || '') });
      queryClient.invalidateQueries({ queryKey: ocrKeys.accountingSupplierSuggestionsByCompany(activeCompanyId || '') });
      const row = r.data;
      setExtracted((ex: any) =>
        ex ? { ...ex, supplierMatch: { id: row.id, nameAr: row.nameAr, score: 1, status: 'new' } } : null,
      );
      setPrefillOcrSupplierId(row.id);
      userTouchedAccountingRef.current = false;
      setNewOcrSupplierOpen(false);
    } catch {
      setNewOcrError(t('ocrExtractFailed'));
    } finally {
      setNewOcrSaving(false);
    }
  };

  const handleResetImageColumn = useCallback(() => {
    setPreview((prev: any) => {
      revokePreviewUrl(prev);
      return null;
    });
    setBase64(null);
    autoExtractedImageRef.current = null;
    setExtracted(null);
    setError(null);
    setExtractWarning(null);
    setExtractStartedAt(null);
    setExtractFailureStage(null);
    setExtractIssueReport('');
    setIssueCopied(false);
    setExtractStageDurations({
      uploadReadyMs: null,
      modelRequestMs: null,
      jsonValidationMs: null,
      enrichmentMs: null,
      readyForReviewMs: null,
    });
    setEditItems(null);
    setFinalizeOcrId(null);
    setPrefillLinkedPurchase(null);
    setPostSaveLinkedPurchase(null);
    setPrefillOcrSupplierId(null);
    setCreateLinkedPurchase(false);
    setAccountingSupplierId('');
    setVaultId('');
    setPurchaseSupplierInvoiceNumber('');
    setTransactionDate(getSaudiToday());
  }, []);

  const onAccountingSupplierIdChange = useCallback((v: any) => {
    userTouchedAccountingRef.current = true;
    setAccountingSupplierId(v);
  }, []);

  const isAr = language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  return {
    t,
    language,
    isAr,
    dir,
    dragging,
    setDragging,
    preview,
    imageBase64,
    extracted,
    loading,
    saving,
    success,
    error,
    extractWarning,
    extractStartedAt,
    extractFailureStage,
    extractStageDurations,
    extractIssueReport,
    issueCopied,
    prefillLoading,
    prefillLinkedPurchase,
    postSaveLinkedPurchase,
    fileRef,
    canCreatePurchase,
    supplierNameForSuggest,
    invoiceVatDigits,
    finalizeOcrId,
    vaultRows,
    accSuggestions,
    accSuggestionsFetching,
    suppliers,
    items,
    createLinkedPurchase,
    setCreateLinkedPurchase,
    transactionDate,
    setTransactionDate,
    accountingSupplierId,
    vaultId,
    setVaultId,
    purchaseSupplierInvoiceNumber,
    setPurchaseSupplierInvoiceNumber,
    isPurchaseTaxable,
    setIsPurchaseTaxable,
    prefillOcrSupplierId,
    warningCount,
    activeItems,
    updateItem,
    applyMathSuggestion,
    handleSupplierMatchChange,
    handleItemMatchChange,
    onAccountingSupplierIdChange,
    readFile,
    handleDrop,
    handleExtract,
    handleCopyIssueReport,
    handleSave,
    handleResetImageColumn,
    openNewOcrSupplierModal,
    handleSubmitNewOcrSupplier,
    newOcrSupplierOpen,
    setNewOcrSupplierOpen,
    newOcrNameAr,
    setNewOcrNameAr,
    newOcrTax,
    setNewOcrTax,
    newOcrSaving,
    newOcrError,
  };
}
