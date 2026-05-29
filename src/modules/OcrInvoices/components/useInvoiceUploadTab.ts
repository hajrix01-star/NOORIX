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

function makeEmptyStageDurations() {
  return {
    uploadReadyMs: null,
    modelRequestMs: null,
    jsonValidationMs: null,
    enrichmentMs: null,
    readyForReviewMs: null,
  };
}

function toDurationMs(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toJsonLine(value: unknown, maxLen = 1600): string {
  try {
    const raw = JSON.stringify(value);
    if (!raw) return '';
    return raw.length > maxLen ? `${raw.slice(0, maxLen)}…[truncated]` : raw;
  } catch {
    return String(value ?? '');
  }
}

function buildStageArtifacts(args: {
  startedAt: number;
  mimeType: string;
  imageBytes: number;
  payload?: Record<string, any> | null;
  stageDurations: {
    uploadReadyMs: number | null;
    modelRequestMs: number | null;
    jsonValidationMs: number | null;
    enrichmentMs: number | null;
    readyForReviewMs: number | null;
  };
  failureStage?: 'model_request' | 'json_validation' | null;
  failureReason?: string;
}) {
  const payload = args.payload || {};
  const attempts = Array.isArray(payload.modelAttempts) ? payload.modelAttempts : [];
  const schemaIssues = Array.isArray(payload.schemaIssues) ? payload.schemaIssues : [];
  const qualityFlags = Array.isArray(payload.qualityFlags) ? payload.qualityFlags : [];
  const items = Array.isArray(payload.items) ? payload.items : [];
  const matchedItems = items.filter((x: any) => x?.itemMatch?.id).length;
  const nowIso = new Date(args.startedAt).toISOString();

  const modelStatus = args.failureStage === 'model_request'
    ? 'failed'
    : attempts.some((x: any) => x?.outcome === 'success')
      ? 'success'
      : 'warning';
  const jsonStatus = args.failureStage === 'json_validation'
    ? 'failed'
    : payload.parseError
      ? 'failed'
      : 'success';
  const enrichStatus = payload.parseError ? 'skipped' : payload.enrichError ? 'warning' : 'success';
  const readyStatus = payload.parseError ? 'failed' : 'success';

  return {
    uploadReady: {
      status: 'success',
      reportText: [
        'OCR Stage Artifact',
        'stage=upload_ready',
        'status=success',
        `startedAt=${nowIso}`,
        `mimeType=${args.mimeType}`,
        `imageBytes=${args.imageBytes}`,
        `durationMs=${args.stageDurations.uploadReadyMs ?? 0}`,
      ].join('\n'),
    },
    modelRequest: {
      status: modelStatus,
      reportText: [
        'OCR Stage Artifact',
        'stage=model_request',
        `status=${modelStatus}`,
        `durationMs=${args.stageDurations.modelRequestMs ?? 0}`,
        `attemptsCount=${attempts.length}`,
        `attempts=${toJsonLine(attempts.map((a: any, idx: number) => ({
          idx: idx + 1,
          model: a?.model,
          outcome: a?.outcome,
          latencyMs: a?.latencyMs,
          parseStage: a?.parseStage,
          httpStatus: a?.httpStatus,
          error: a?.error,
        })))}`,
        args.failureStage === 'model_request' ? `failureReason=${args.failureReason || 'model_request_failed'}` : null,
      ].filter(Boolean).join('\n'),
    },
    jsonValidation: {
      status: jsonStatus,
      reportText: [
        'OCR Stage Artifact',
        'stage=json_validation',
        `status=${jsonStatus}`,
        `durationMs=${args.stageDurations.jsonValidationMs ?? 0}`,
        `parseError=${!!payload.parseError}`,
        `parseStageHints=${toJsonLine(attempts.map((a: any) => ({ model: a?.model, parseStage: a?.parseStage, outcome: a?.outcome })))}`,
        schemaIssues.length ? `schemaIssues=${toJsonLine(schemaIssues)}` : null,
        payload.rawText ? `rawTextSnippet=${String(payload.rawText).slice(0, 400)}` : null,
        args.failureStage === 'json_validation' ? `failureReason=${args.failureReason || payload.errorDetail || 'json_validation_failed'}` : null,
      ].filter(Boolean).join('\n'),
    },
    enrichment: {
      status: enrichStatus,
      reportText: [
        'OCR Stage Artifact',
        'stage=enrichment',
        `status=${enrichStatus}`,
        `durationMs=${args.stageDurations.enrichmentMs ?? 0}`,
        `supplierName=${payload?.supplier?.name || ''}`,
        `supplierMatched=${!!payload?.supplierMatch?.id}`,
        `itemsCount=${items.length}`,
        `matchedItems=${matchedItems}`,
        payload.enrichError ? `enrichError=${String(payload.enrichError)}` : null,
      ].filter(Boolean).join('\n'),
    },
    readyForReview: {
      status: readyStatus,
      reportText: [
        'OCR Stage Artifact',
        'stage=ready_for_review',
        `status=${readyStatus}`,
        `durationMs=${args.stageDurations.readyForReviewMs ?? 0}`,
        `qualityStatus=${String(payload.qualityStatus || '')}`,
        `qualityFlags=${toJsonLine(qualityFlags)}`,
        `usedModel=${String(payload.usedModel || '')}`,
        `extractionLatencyMs=${Number(payload.extractionLatencyMs) || 0}`,
      ].join('\n'),
    },
  };
}

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
  const [extractStageArtifacts, setExtractStageArtifacts] = useState<Record<string, { status?: string; reportText: string }> | null>(null);
  const [copiedStageKey, setCopiedStageKey] = useState<string | null>(null);
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
    setExtractStageArtifacts(null);
    setCopiedStageKey(null);
    setExtractStageDurations({ ...makeEmptyStageDurations(), uploadReadyMs: 0 });
    setLoading(true);
    setError(null);
    setExtractWarning(null);
    const requestStartedAt = Date.now();
    try {
      const res = await extractInvoice(imageBase64, mimeType);
      const modelRequestMs = Math.max(1, Date.now() - requestStartedAt);
      const payload = res.data && typeof res.data === 'object' ? res.data as Record<string, any> : null;
      const stageTelemetry = payload?.extractionStageTelemetry && typeof payload.extractionStageTelemetry === 'object'
        ? payload.extractionStageTelemetry as Record<string, any>
        : null;
      const stageRows = stageTelemetry?.stages && typeof stageTelemetry.stages === 'object'
        ? stageTelemetry.stages as Record<string, any>
        : null;
      const stageDurationsFromBackend = {
        uploadReadyMs: 0,
        modelRequestMs: toDurationMs(stageRows?.modelRequest?.durationMs) ?? modelRequestMs,
        jsonValidationMs: toDurationMs(stageRows?.jsonValidation?.durationMs),
        enrichmentMs: toDurationMs(stageRows?.enrichment?.durationMs),
        readyForReviewMs: toDurationMs(stageRows?.readyForReview?.durationMs) ?? 0,
      };
      const backendArtifacts = stageTelemetry?.artifacts && typeof stageTelemetry.artifacts === 'object'
        ? stageTelemetry.artifacts as Record<string, { status?: string; reportText?: string }>
        : null;
      if (res.success) {
        if (res.data?.parseError) {
          const parseStartedAt = Date.now();
          setExtractFailureStage('parse');
          const debugRaw = payload || {};
          const modelAttempts = Array.isArray(debugRaw.modelAttempts) ? debugRaw.modelAttempts : [];
          const schemaIssues = Array.isArray(debugRaw.schemaIssues) ? debugRaw.schemaIssues : [];
          const failedStageKey = String(stageTelemetry?.failedStage || 'json_validation');
          const failedReason = String(stageTelemetry?.failureReason || debugRaw.errorDetail || 'parse_or_schema_failed');
          const issueReport = [
            `OCR Pipeline Failure`,
            `stage=${failedStageKey}`,
            `friendlyError=${t('ocrParseFriendlyError')}`,
            `errorDetail=${failedReason}`,
            `rawTextSnippet=${String(debugRaw.rawText || '').slice(0, 400)}`,
            schemaIssues.length ? `schemaIssues=${schemaIssues.join(' | ')}` : null,
            `modelAttempts=${JSON.stringify(modelAttempts)}`,
            `stageDurations=${JSON.stringify(stageDurationsFromBackend)}`,
            `clientElapsedMs=${Date.now() - startedAt}`,
          ].filter(Boolean).join('\n');
          setExtractIssueReport(issueReport);
          const fallbackArtifacts = buildStageArtifacts({
            startedAt,
            mimeType,
            imageBytes: imageBase64.length,
            payload,
            stageDurations: {
              ...stageDurationsFromBackend,
              jsonValidationMs:
                stageDurationsFromBackend.jsonValidationMs ?? Math.max(1, Date.now() - parseStartedAt),
            },
            failureStage: 'json_validation',
            failureReason: failedReason,
          });
          setExtractStageArtifacts(
            backendArtifacts
              ? { ...fallbackArtifacts, ...backendArtifacts }
              : fallbackArtifacts,
          );
          setExtractStageDurations({
            ...stageDurationsFromBackend,
            jsonValidationMs:
              stageDurationsFromBackend.jsonValidationMs ?? Math.max(1, Date.now() - parseStartedAt),
          });
          setError(t('ocrParseFriendlyError'));
        } else {
          const fallbackArtifacts = buildStageArtifacts({
            startedAt,
            mimeType,
            imageBytes: imageBase64.length,
            payload,
            stageDurations: stageDurationsFromBackend,
          });
          setExtractStageArtifacts(
            backendArtifacts
              ? { ...fallbackArtifacts, ...backendArtifacts }
              : fallbackArtifacts,
          );
          setExtractStageDurations(stageDurationsFromBackend);
          setExtracted(res.data);
          setEditItems(null);
          if (res.data?.enrichError) {
            setExtractWarning(t('ocrEnrichWarning'));
          }
        }
      } else {
        setExtractFailureStage('request');
        const requestError = res.error || t('ocrExtractFailed');
        const failedDurations = { ...makeEmptyStageDurations(), uploadReadyMs: 0, modelRequestMs };
        setExtractStageDurations({ ...makeEmptyStageDurations(), uploadReadyMs: 0, modelRequestMs });
        setExtractStageArtifacts(buildStageArtifacts({
          startedAt,
          mimeType,
          imageBytes: imageBase64.length,
          payload: null,
          stageDurations: failedDurations,
          failureStage: 'model_request',
          failureReason: requestError,
        }));
        setExtractIssueReport([
          'OCR Pipeline Failure',
          'stage=model_request',
          `error=${String(requestError)}`,
          `stageDurations=${JSON.stringify({ uploadReadyMs: 0, modelRequestMs })}`,
          `clientElapsedMs=${Date.now() - startedAt}`,
        ].join('\n'));
        setError(requestError);
      }
    } catch (err: any) {
      setExtractFailureStage('request');
      const msg = err?.message || t('ocrExtractFailed');
      const failedDurations = {
        ...makeEmptyStageDurations(),
        uploadReadyMs: 0,
        modelRequestMs: Math.max(1, Date.now() - requestStartedAt),
      };
      setExtractStageDurations(failedDurations);
      setExtractStageArtifacts(buildStageArtifacts({
        startedAt,
        mimeType,
        imageBytes: imageBase64.length,
        payload: null,
        stageDurations: failedDurations,
        failureStage: 'model_request',
        failureReason: msg,
      }));
      setExtractIssueReport([
        'OCR Pipeline Failure',
        'stage=model_request',
        `error=${String(msg)}`,
        `stageDurations=${JSON.stringify({ uploadReadyMs: 0, modelRequestMs: Math.max(1, Date.now() - requestStartedAt) })}`,
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

  const handleCopyStageArtifact = useCallback(async (stageKey: string) => {
    const report = extractStageArtifacts?.[stageKey]?.reportText;
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopiedStageKey(stageKey);
      window.setTimeout(() => {
        setCopiedStageKey((current) => (current === stageKey ? null : current));
      }, 1800);
    } catch {
      setCopiedStageKey(null);
    }
  }, [extractStageArtifacts]);

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
      setExtractStageArtifacts(null);
      setCopiedStageKey(null);
      setExtractStageDurations(makeEmptyStageDurations());
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
    setExtractStageArtifacts(null);
    setCopiedStageKey(null);
    setExtractStageDurations(makeEmptyStageDurations());
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
    extractStageArtifacts,
    copiedStageKey,
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
    handleCopyStageArtifact,
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
