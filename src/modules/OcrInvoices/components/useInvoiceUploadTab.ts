import { useState, useRef, useCallback, useMemo } from 'react';
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
export function useInvoiceUploadTab({ onSaved, prefillInvoiceId, onPrefillConsumed }: any) {
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
  const [success, setSuccess] = useState(false);
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
  const userTouchedAccountingRef = useRef(false);
  const [newOcrSupplierOpen, setNewOcrSupplierOpen] = useState(false);
  const [newOcrNameAr, setNewOcrNameAr] = useState('');
  const [newOcrTax, setNewOcrTax] = useState('');
  const [newOcrSaving, setNewOcrSaving] = useState(false);
  const [newOcrError, setNewOcrError] = useState<any>(null);

  const { activeItems, warningCount, updateItem, applyMathSuggestion } = useOcrInvoiceLineItems(
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

  const handleExtract = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const res = await extractInvoice(imageBase64, mimeType);
      if (res.success) {
        if (res.data?.parseError) {
          const detail = res.data.errorDetail || '';
          const model = res.data.usedModel || '';
          const rawSnippet = res.data.rawText ? `\n\nGemini raw: ${res.data.rawText.substring(0, 200)}` : '';
          setError(`${t('ocrExtractFailed')} — تعذّر قراءة الفاتورة.\nModel: ${model}\n${detail}${rawSnippet}`);
        } else {
          setExtracted(res.data);
          setEditItems(null);
          if (res.data?.enrichError) {
            console.warn('OCR enrichment warning:', res.data.enrichError);
          }
        }
      } else {
        setError(res.error || t('ocrExtractFailed'));
      }
    } catch {
      setError(t('ocrExtractFailed'));
    } finally {
      setLoading(false);
    }
  };

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
    setExtracted(null);
    setError(null);
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
    onAccountingSupplierIdChange,
    readFile,
    handleDrop,
    handleExtract,
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
