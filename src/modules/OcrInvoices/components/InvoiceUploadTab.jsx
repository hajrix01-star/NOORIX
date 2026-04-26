import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../constants/permissions';
import { getSaudiToday } from '../../../utils/saudiDate';
import { compressImageFileToJpegDataUrl } from '../../../utils/imageUtils';
import { getVaults } from '../../../services/api';
import {
  createOcrSupplier,
  extractInvoice,
  getOcrAccountingSupplierSuggestions,
  getOcrInvoice,
  saveOcrInvoice,
} from '../services/ocrApi';
import { ocrInvoiceImageQueryKey, fetchOcrInvoiceImageBlob } from '../ocrInvoiceImageQuery';
import { revokePreviewUrl } from './invoiceUpload/ocrInvoiceUploadUtils';
import {
  OcrUploadPrefillBanner,
  OcrPrefillLinkedPurchaseBanner,
  OcrPostSaveLinkedBanner,
  OcrEmptyImageDropzone,
  OcrErrorBanner,
} from './invoiceUpload/OcrUploadBannersAndDropzone';
import { OcrImagePreviewColumn } from './invoiceUpload/OcrImagePreviewColumn';
import { OcrExtractedInfoAndTotalsCard } from './invoiceUpload/OcrExtractedInfoAndTotalsCard';
import { OcrLinkedPurchaseForm } from './invoiceUpload/OcrLinkedPurchaseForm';
import { OcrLineItemsList, OcrWarningStrip } from './invoiceUpload/OcrLineItemsAndWarnings';
import { OcrNewSupplierModal } from './invoiceUpload/OcrNewSupplierModal';

export default function InvoiceUploadTab({ onSaved, prefillInvoiceId, onPrefillConsumed }) {
  const { t, lang: language } = useTranslation();
  const { activeCompanyId } = useApp();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [imageBase64, setBase64] = useState(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [extracted, setExtracted] = useState(null);
  const [editItems, setEditItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [finalizeOcrId, setFinalizeOcrId] = useState(null);
  const [prefillOcrSupplierId, setPrefillOcrSupplierId] = useState(null);
  const [createLinkedPurchase, setCreateLinkedPurchase] = useState(false);
  const [transactionDate, setTransactionDate] = useState(() => getSaudiToday());
  const [accountingSupplierId, setAccountingSupplierId] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [purchaseSupplierInvoiceNumber, setPurchaseSupplierInvoiceNumber] = useState('');
  const [isPurchaseTaxable, setIsPurchaseTaxable] = useState(true);
  const [prefillLinkedPurchase, setPrefillLinkedPurchase] = useState(null);
  const [postSaveLinkedPurchase, setPostSaveLinkedPurchase] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const fileRef = useRef();
  const userTouchedAccountingRef = useRef(false);
  const [newOcrSupplierOpen, setNewOcrSupplierOpen] = useState(false);
  const [newOcrNameAr, setNewOcrNameAr] = useState('');
  const [newOcrTax, setNewOcrTax] = useState('');
  const [newOcrSaving, setNewOcrSaving] = useState(false);
  const [newOcrError, setNewOcrError] = useState(null);

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
    queryKey: ['vaults', activeCompanyId, 'ocr-finalize'],
    enabled: !!activeCompanyId && !!finalizeOcrId && createLinkedPurchase && canCreatePurchase,
    queryFn: async () => {
      const r = await getVaults(activeCompanyId, false);
      return r.success && Array.isArray(r.data) ? r.data : [];
    },
  });

  const { data: accSuggestions = [], isFetching: accSuggestionsFetching } = useQuery({
    queryKey: [
      'ocr-accounting-supplier-suggestions',
      activeCompanyId,
      prefillOcrSupplierId || '',
      supplierNameForSuggest,
      invoiceVatDigits,
    ],
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

  useEffect(() => {
    userTouchedAccountingRef.current = false;
  }, [accSuggestKey]);

  useEffect(() => {
    if (userTouchedAccountingRef.current) return;
    if (!finalizeOcrId || !canCreatePurchase) return;
    const top = accSuggestions[0];
    if (!top?.id) return;
    const topTax = String(top.taxNumber || '').replace(/\D/g, '');
    const vatMatch = invoiceVatDigits.length >= 9 && topTax === invoiceVatDigits;
    const ms = top.matchScore ?? 0;
    const secondMs = accSuggestions[1]?.matchScore ?? 0;
    const pick =
      !!top.linkedFromOcr ||
      vatMatch ||
      ms >= 100 ||
      (ms >= 72 && accSuggestions.length === 1) ||
      (ms >= 80 && ms >= secondMs + 20);
    if (pick) setAccountingSupplierId(top.id);
  }, [accSuggestions, accSuggestKey, finalizeOcrId, canCreatePurchase, invoiceVatDigits]);

  useEffect(() => {
    if (!prefillInvoiceId) return;
    let cancelled = false;
    setPrefillLoading(true);
    setError(null);
    (async () => {
      try {
        const r = await getOcrInvoice(prefillInvoiceId);
        if (cancelled) return;
        if (!r.success || !r.data) {
          setError(r.error || t('ocrExtractFailed'));
          onPrefillConsumed?.();
          return;
        }
        const inv = r.data;
        const raw = inv.rawExtraction;
        if (raw && typeof raw === 'object') {
          setExtracted(raw);
          setEditItems(null);
        } else {
          setError(
            language === 'ar'
              ? 'لا توجد بيانات استخراج محفوظة لهذه الفاتورة.'
              : 'No saved extraction for this invoice.',
          );
          onPrefillConsumed?.();
          return;
        }
        setFinalizeOcrId(prefillInvoiceId);
        setPrefillLinkedPurchase(inv.linkedPurchaseInvoice?.id ? inv.linkedPurchaseInvoice : null);
        setPrefillOcrSupplierId(inv.supplierId || null);
        setPurchaseSupplierInvoiceNumber(String(inv.invoiceNumber || raw?.invoiceNumber?.value || '').trim());
        setTransactionDate(getSaudiToday());
        setCreateLinkedPurchase(false);
        setAccountingSupplierId('');
        setVaultId('');
        if (cancelled) return;
        try {
          const blob = await queryClient.ensureQueryData({
            queryKey: ocrInvoiceImageQueryKey(activeCompanyId, prefillInvoiceId),
            queryFn: ({ signal }) => fetchOcrInvoiceImageBlob(prefillInvoiceId, signal),
            staleTime: 5 * 60 * 1000,
          });
          if (cancelled) return;
          setPreview((prev) => {
            revokePreviewUrl(prev);
            return URL.createObjectURL(blob);
          });
          setMimeType(blob.type || 'image/jpeg');
        } catch {
          /* optional image */
        }
        setBase64(null);
      } catch {
        if (!cancelled) setError(t('ocrExtractFailed'));
      } finally {
        if (!cancelled) {
          setPrefillLoading(false);
          onPrefillConsumed?.();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefillInvoiceId, onPrefillConsumed, language, activeCompanyId, queryClient]);

  const activeItems = editItems ?? extracted?.items ?? [];

  const warningCount = useMemo(() => {
    let n = 0;
    if (extracted?.invoiceTotalWarning) n++;
    activeItems.forEach((item) => {
      if (item.mathWarning) n++;
      if (item.priceWarning) n++;
    });
    return n;
  }, [extracted?.invoiceTotalWarning, activeItems]);

  const updateItem = (index, field, value) => {
    const num = parseFloat(value);
    const updated = [...activeItems];
    updated[index] = { ...updated[index], [field]: isNaN(num) ? value : num };
    const item = updated[index];
    if ((field === 'quantity' || field === 'unitPrice') && item.quantity > 0 && item.unitPrice > 0) {
      updated[index] = {
        ...updated[index],
        totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
        mathWarning: undefined,
      };
    }
    if (field === 'totalPrice') {
      updated[index] = { ...updated[index], mathWarning: undefined };
    }
    setEditItems(updated);
  };

  const applyMathSuggestion = (index) => {
    const item = activeItems[index];
    if (!item.mathWarning) return;
    const updated = [...activeItems];
    if (item.mathWarning.suggestedQuantity !== undefined) {
      updated[index] = { ...updated[index], quantity: item.mathWarning.suggestedQuantity, mathWarning: undefined };
    } else if (item.mathWarning.suggestedUnitPrice !== undefined) {
      updated[index] = { ...updated[index], unitPrice: item.mathWarning.suggestedUnitPrice, mathWarning: undefined };
    }
    setEditItems(updated);
  };

  const readFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    void compressImageFileToJpegDataUrl(file, { maxDim: 1600, quality: 0.82 })
      .then((compressed) => {
        setPreview((prev) => {
          revokePreviewUrl(prev);
          return compressed;
        });
        setBase64(compressed.split(',')[1]);
        setMimeType('image/jpeg');
        setExtracted(null);
        setFinalizeOcrId(null);
        setPrefillLinkedPurchase(null);
        setPostSaveLinkedPurchase(null);
        setPrefillOcrSupplierId(null);
        setCreateLinkedPurchase(false);
        setAccountingSupplierId('');
        setVaultId('');
        setPurchaseSupplierInvoiceNumber('');
        setTransactionDate(getSaudiToday());
        setError(null);
        setSuccess(false);
      })
      .catch((err) => {
        setError(err?.message || 'تعذّر قراءة الصورة');
        setSuccess(false);
      });
  }, []);

  const handleDrop = useCallback(
    (e) => {
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
    if (createLinkedPurchase && finalizeOcrId && canCreatePurchase) {
      if (!accountingSupplierId) {
        setError(language === 'ar' ? 'اختر مورد المحاسبة.' : 'Select an accounting supplier.');
        return;
      }
      if (!vaultId) {
        setError(language === 'ar' ? 'اختر الخزنة.' : 'Select a vault.');
        return;
      }
      if (!transactionDate?.trim()) {
        setError(language === 'ar' ? 'أدخل تاريخ العملية.' : 'Enter transaction date.');
        return;
      }
      if (
        isPurchaseTaxable &&
        !purchaseSupplierInvoiceNumber?.trim() &&
        !extracted.invoiceNumber?.value &&
        !extracted.invoiceNumber
      ) {
        setError(
          language === 'ar'
            ? 'رقم فاتورة المورد مطلوب للمشتريات الخاضعة للضريبة.'
            : 'Supplier invoice number is required for taxable purchases.',
        );
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const lines = activeItems.map((item) => ({
        rawName: item.name || '',
        nameAr: item.nameAr || null,
        nameEn: item.nameEn || null,
        size: item.size || null,
        sizeUnit: item.sizeUnit || null,
        itemId: item.itemMatch?.id || null,
        quantity: item.quantity || null,
        unitPrice: item.unitPrice || null,
        totalPrice: item.totalPrice || null,
        confidence: item.confidence || 0,
        matchStatus: item.itemMatch?.status || 'pending',
      }));

      const payload = {
        ...(finalizeOcrId ? { id: finalizeOcrId } : {}),
        supplierId: extracted.supplierMatch?.id || null,
        supplierName: !extracted.supplierMatch?.id ? extracted.supplier?.name || null : null,
        invoiceNumber: extracted.invoiceNumber?.value || null,
        invoiceDate: extracted.invoiceDate?.value || null,
        subtotalAmount: extracted.subtotalAmount?.value || null,
        totalAmount: extracted.totalAmount?.value || null,
        vatAmount: extracted.vatAmount?.value || null,
        imageUrl: preview && !String(preview).startsWith('blob:') ? preview : null,
        rawExtraction: extracted,
        lines,
        ...(createLinkedPurchase && finalizeOcrId && canCreatePurchase
          ? {
              purchase: {
                accountingSupplierId,
                transactionDate: transactionDate.slice(0, 10),
                vaultId,
                isTaxable: isPurchaseTaxable,
                ...(purchaseSupplierInvoiceNumber.trim()
                  ? { supplierInvoiceNumber: purchaseSupplierInvoiceNumber.trim() }
                  : {}),
              },
            }
          : {}),
      };

      const res = await saveOcrInvoice(payload);
      if (res.success) {
        const lp = res.data?.linkedPurchaseInvoice;
        const hasLedgerLink = !!(lp?.id || res.data?.linkedPurchaseInvoiceId);
        setSuccess(true);
        onSaved?.({ invalidateFinancial: hasLedgerLink });
        setPostSaveLinkedPurchase(lp?.id ? lp : null);
        const delayMs = hasLedgerLink ? 7000 : 2000;
        setTimeout(() => {
          setPreview((prev) => {
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
      queryClient.invalidateQueries({ queryKey: ['ocr-suppliers', activeCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['ocr-accounting-supplier-suggestions', activeCompanyId] });
      const row = r.data;
      setExtracted((ex) =>
        ex
          ? { ...ex, supplierMatch: { id: row.id, nameAr: row.nameAr, score: 1, status: 'new' } }
          : null,
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
    setPreview((prev) => {
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

  const isAr = language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <div className="flex flex-col gap-5" dir={dir}>
      <OcrUploadPrefillBanner t={t} prefillLoading={prefillLoading} />
      <OcrPrefillLinkedPurchaseBanner t={t} prefillLinkedPurchase={prefillLinkedPurchase} />
      <OcrPostSaveLinkedBanner
        t={t}
        success={success}
        postSaveLinkedPurchase={postSaveLinkedPurchase}
      />

      {!preview && (
        <OcrEmptyImageDropzone
          t={t}
          dragging={dragging}
          onDragOver={() => {
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClickPick={() => fileRef.current?.click()}
          fileRef={fileRef}
          onFileInputChange={readFile}
        />
      )}

      {preview && (
        <div className="flex flex flex-wrap gap-[18px] items-start">
          <OcrImagePreviewColumn
            t={t}
            isAr={isAr}
            preview={preview}
            imageBase64={imageBase64}
            extracted={extracted}
            loading={loading}
            saving={saving}
            success={success}
            onResetAll={handleResetImageColumn}
            onExtract={handleExtract}
            onSave={handleSave}
          />

          {extracted && (
            <div className="flex flex-col gap-[14px] flex-[1_1_280px] min-w-0">
              <OcrExtractedInfoAndTotalsCard t={t} extracted={extracted} isAr={isAr} />
              <OcrLinkedPurchaseForm
                t={t}
                finalizeOcrId={finalizeOcrId}
                canCreatePurchase={canCreatePurchase}
                accSuggestions={accSuggestions}
                accSuggestionsFetching={accSuggestionsFetching}
                accountingSupplierId={accountingSupplierId}
                onAccountingSupplierIdChange={(v) => {
                  userTouchedAccountingRef.current = true;
                  setAccountingSupplierId(v);
                }}
                onOpenNewOcrSupplier={openNewOcrSupplierModal}
                prefillOcrSupplierId={prefillOcrSupplierId}
                prefillLoading={prefillLoading}
                supplierNameForSuggest={supplierNameForSuggest}
                invoiceVatDigits={invoiceVatDigits}
                createLinkedPurchase={createLinkedPurchase}
                onCreateLinkedPurchaseChange={setCreateLinkedPurchase}
                transactionDate={transactionDate}
                onTransactionDateChange={setTransactionDate}
                vaultId={vaultId}
                onVaultIdChange={setVaultId}
                vaultRows={vaultRows}
                purchaseSupplierInvoiceNumber={purchaseSupplierInvoiceNumber}
                onPurchaseSupplierInvoiceNumberChange={setPurchaseSupplierInvoiceNumber}
                extracted={extracted}
                isPurchaseTaxable={isPurchaseTaxable}
                onIsPurchaseTaxableChange={setIsPurchaseTaxable}
              />
              <OcrWarningStrip warningCount={warningCount} extracted={extracted} isAr={isAr} />
              <OcrLineItemsList
                t={t}
                language={language}
                activeItems={activeItems}
                onUpdateItem={updateItem}
                onApplySuggestion={applyMathSuggestion}
              />
            </div>
          )}
        </div>
      )}

      <OcrErrorBanner error={error} />
      <OcrNewSupplierModal
        t={t}
        open={newOcrSupplierOpen}
        dir={dir}
        isSaving={newOcrSaving}
        nameAr={newOcrNameAr}
        onNameArChange={setNewOcrNameAr}
        tax={newOcrTax}
        onTaxChange={setNewOcrTax}
        error={newOcrError}
        onClose={() => setNewOcrSupplierOpen(false)}
        onSubmit={handleSubmitNewOcrSupplier}
      />
    </div>
  );
}
