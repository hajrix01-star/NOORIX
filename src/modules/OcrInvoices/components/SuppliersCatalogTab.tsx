import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import {
  createOcrSupplier,
  updateOcrSupplier,
  deleteOcrSupplier,
  addSupplierAlias,
  bulkDeleteOcrSuppliers,
  getOcrAccountingSupplierSuggestions,
} from '../services/ocrApi';
import { getSuppliers } from '../../../services/api';
import { assertApiOk } from '../../../utils/apiResponse';
import { OCR_SUPPLIER_CATEGORY_OPTIONS, ocrSupplierCategoryLabel } from '../constants/ocrSupplierCategories';

/** ترتيب موردي المحاسبة حسب الاسم أو الرقم الضريبي (درجة أعلى = أقرب) */
function scoreAccountingSupplierMatch(row: any, queryRaw: any) {
  const q = queryRaw.trim().toLowerCase();
  const qDigits = queryRaw.replace(/\D/g, '');
  const ar = (row.nameAr || '').toLowerCase();
  const en = (row.nameEn || '').toLowerCase();
  const td = (row.taxNumber || '').replace(/\D/g, '');
  let score = 0;
  if (qDigits.length >= 5 && td) {
    if (td === qDigits) score += 100000;
    else if (td.endsWith(qDigits) || qDigits.endsWith(td)) score += 60000;
    else if (td.includes(qDigits) || qDigits.includes(td)) score += 35000 + Math.min(qDigits.length, 15) * 400;
  }
  if (q.length >= 1) {
    if (ar === q || en === q) score += 45000;
    else if (ar.startsWith(q) || en.startsWith(q)) score += 28000;
    else if (ar.includes(q) || en.includes(q)) score += 12000 + Math.min(q.length, 24) * 180;
    const blob = `${ar} ${en}`;
    if (blob.includes(q) && score < 8000) score += 8000;
  }
  return score;
}

function SupplierForm({ initial = {}, onSave, onCancel, loading }: any) {
  const { t, lang } = useTranslation();
  const isAr = lang === 'ar';
  const [form, setForm] = useState({
    nameAr: '', nameEn: '', taxNumber: '', phone: '', notes: '', supplierCategory: '', ...initial,
  });
  const f = (k: any) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="grid gap-3">
      <Input placeholder={`${t('ocrSupplierNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} />
      <Input placeholder={t('ocrSupplierNameEn')} value={form.nameEn} onChange={f('nameEn')} />
      <Input placeholder={t('ocrSupplierTax')} value={form.taxNumber} onChange={f('taxNumber')} />
      <Input placeholder={t('ocrSupplierPhone')} value={form.phone} onChange={f('phone')} />
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-noorix-muted">{t('ocrSupplierCategory')}</span>
        <select
          className="rounded-md border border-noorix-border bg-noorix-bg-surface px-2 py-2 text-[13px] text-noorix-text"
          value={form.supplierCategory || ''}
          onChange={f('supplierCategory')}
        >
          {OCR_SUPPLIER_CATEGORY_OPTIONS.map((opt: any) => (
            <option key={opt.value || 'none'} value={opt.value}>
              {opt.labelKey ? t(opt.labelKey) : (isAr ? '—' : '—')}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={loading || !form.nameAr} variant="primary" className="flex-1 min-w-0">
          {loading ? '...' : t('ocrSave')}
        </Button>
        <Button onClick={onCancel} className="flex-1 min-w-0">{t('ocrCancel')}</Button>
      </div>
    </div>
  );
}

export default function SuppliersCatalogTab({ suppliers = [], loading, onRefresh }: any) {
  const { t, lang: language } = useTranslation();
  const { activeCompanyId } = useApp();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<any>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasLang, setAliasLang] = useState('ar');
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [linkAccId, setLinkAccId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkSaveFlash, setLinkSaveFlash] = useState(false);
  const [accSearchQuery, setAccSearchQuery] = useState('');
  const [supplierCategoryLocal, setSupplierCategoryLocal] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const { data: accountingSuppliers = [] } = useQuery({
    queryKey: ['accounting-suppliers-ocr-catalog', activeCompanyId],
    enabled: !!activeCompanyId && !!viewing,
    queryFn: async () => {
      const r = await getSuppliers(activeCompanyId, 1, 500);
      if (!r.success) return [];
      if (Array.isArray(r.data)) return r.data;
      return r.data?.items || r.data?.data || [];
    },
  });

  const ocrNameSuggest = useMemo(
    () => String(viewing?.nameAr || viewing?.nameEn || '').trim().slice(0, 120),
    [viewing?.nameAr, viewing?.nameEn],
  );
  const ocrTaxDigits = useMemo(
    () => String(viewing?.taxNumber || '').replace(/\D/g, ''),
    [viewing?.taxNumber],
  );

  const { data: accLinkSuggestions = [], isFetching: accSuggestionsFetching } = useQuery({
    queryKey: [
      'ocr-catalog-accounting-suggestions',
      activeCompanyId,
      viewing?.id || '',
      ocrNameSuggest,
      ocrTaxDigits,
    ],
    enabled: !!activeCompanyId && !!viewing?.id,
    queryFn: async () => {
      const r = await getOcrAccountingSupplierSuggestions({
        ocrSupplierId: viewing.id,
        ...(ocrNameSuggest.length >= 1 ? { q: ocrNameSuggest } : {}),
        ...(ocrTaxDigits.length >= 9
          ? { invoiceVat: String(viewing.taxNumber || '').trim() || ocrTaxDigits }
          : {}),
        limit: 24,
      });
      return r.success && Array.isArray(r.data) ? r.data : [];
    },
  });

  const toggleSelect = (id: any) => setSelected((prev: any) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleBulkDelete = async () => {
    if (!selected.size || !window.confirm(`حذف ${selected.size} مورد؟`)) return;
    setDeleting(true);
    await bulkDeleteOcrSuppliers([...selected]);
    setSelected(new Set());
    setDeleting(false);
    onRefresh();
  };

  const displayedSuppliers = useMemo(() => {
    const q = search.toLowerCase();
    const list = suppliers.filter((s: any) => {
      const okSearch =
        !q ||
        s.nameAr?.toLowerCase().includes(q) ||
        s.nameEn?.toLowerCase().includes(q) ||
        s.taxNumber?.includes(q);
      const okCat = !categoryFilter || (s.supplierCategory || '') === categoryFilter;
      return okSearch && okCat;
    });
    return [...list].sort((a: any, b: any) => {
      const ca = (a.supplierCategory || '').localeCompare(b.supplierCategory || '');
      if (ca !== 0) return ca;
      return (a.nameAr || '').localeCompare(b.nameAr || '', 'ar');
    });
  }, [suppliers, search, categoryFilter]);

  const handleCreate = async (data: any) => {
    setSaving(true);
    try {
      const res = await createOcrSupplier({
        ...data,
        supplierCategory: data.supplierCategory || null,
      });
      assertApiOk(res, t('saveFailed'));
      setAdding(false);
      onRefresh();
    } catch (e: any) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: any) => {
    setSaving(true);
    try {
      const res = await updateOcrSupplier(editing.id, {
        ...data,
        supplierCategory: data.supplierCategory || null,
      });
      assertApiOk(res, t('saveFailed'));
      setEditing(null);
      onRefresh();
    } catch (e: any) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm('هل تريد حذف هذا المورد؟')) return;
    await deleteOcrSupplier(id);
    onRefresh();
  };

  const handleAddAlias = async () => {
    if (!aliasInput || !viewing) return;
    await addSupplierAlias(viewing.id, aliasInput, aliasLang);
    setAliasInput('');
    onRefresh();
    const updated = suppliers.find((s: any) => s.id === viewing.id);
    if (updated) setViewing(updated);
  };

  const openViewing = (s: any) => {
    setViewing(s);
    setLinkAccId(s.accountingSupplier?.id || '');
    setLinkSaveFlash(false);
    setAccSearchQuery(String(s.nameAr || s.nameEn || '').trim().slice(0, 96));
    setSupplierCategoryLocal(s.supplierCategory || '');
  };

  const handleSaveSupplierCategory = async () => {
    if (!viewing) return;
    setCategorySaving(true);
    try {
      const res = await updateOcrSupplier(viewing.id, {
        supplierCategory: supplierCategoryLocal || null,
      });
      assertApiOk(res, t('saveFailed'));
      const next = res.data;
      if (next && typeof next === 'object' && next.id) setViewing(next);
      await onRefresh();
    } catch (e: any) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setCategorySaving(false);
    }
  };

  const handleSaveAccountingLink = async () => {
    if (!viewing) return;
    setLinkSaving(true);
    try {
      const res = await updateOcrSupplier(viewing.id, {
        accountingSupplierId: linkAccId || null,
      });
      assertApiOk(res, t('saveFailed'));
      const next = res.data;
      if (next && typeof next === 'object' && next.id) {
        setViewing(next);
        setLinkAccId(next.accountingSupplier?.id || '');
      }
      await onRefresh();
      setLinkSaveFlash(true);
      window.setTimeout(() => setLinkSaveFlash(false), 5000);
    } catch (e: any) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setLinkSaving(false);
    }
  };

  const isAr = language === 'ar';
  const allChecked = displayedSuppliers.length > 0 && displayedSuppliers.every((s: any) => selected.has(s.id));

  const accOptions = useMemo(
    () => [...accountingSuppliers].sort((a: any, b: any) => (a.nameAr || '').localeCompare(b.nameAr || '', 'ar')),
    [accountingSuppliers],
  );

  const rankedAccountingForPicker = useMemo(() => {
    const q = accSearchQuery.trim();
    const suggestOrder = new Map(accLinkSuggestions.map((s: any, i: any) => [s.id, i]));
    const boost = (id: any) => {
      const sug = accLinkSuggestions.find((x: any) => x.id === id);
      return (sug?.matchScore ?? 0) * 50 + (sug?.linkedFromOcr ? 500000 : 0);
    };
    if (!q) {
      return [...accOptions]
        .sort((a: any, b: any) => {
          const ia = suggestOrder.has(a.id) ? suggestOrder.get(a.id) : 999;
          const ib = suggestOrder.has(b.id) ? suggestOrder.get(b.id) : 999;
          if (ia !== ib) return ia - ib;
          return (a.nameAr || '').localeCompare(b.nameAr || '', 'ar');
        })
        .slice(0, 80);
    }
    const scored = accOptions
      .map((row: any) => ({ row, score: scoreAccountingSupplierMatch(row, accSearchQuery) + boost(row.id) }))
      .filter((x: any) => x.score > 0)
      .sort((a: any, b: any) => b.score - a.score);
    return scored.map((x: any) => x.row).slice(0, 50);
  }, [accOptions, accSearchQuery, accLinkSuggestions]);

  const selectedAccRow = useMemo(
    () => accOptions.find((a: any) => a.id === linkAccId) || null,
    [accOptions, linkAccId],
  );

  const displayAcc = useMemo(() => {
    if (selectedAccRow) return selectedAccRow;
    const a = viewing?.accountingSupplier;
    if (a?.id && a.id === linkAccId) return a;
    return null;
  }, [selectedAccRow, viewing?.accountingSupplier, linkAccId]);

  const pendingDisplay = useMemo(
    () =>
      selectedAccRow ||
      accLinkSuggestions.find((x: any) => x.id === linkAccId) ||
      null,
    [selectedAccRow, accLinkSuggestions, linkAccId],
  );

  const savedAccId = viewing?.accountingSupplier?.id || '';
  const linkDirty = !!viewing && (linkAccId || '') !== (savedAccId || '');
  const showLinkedBanner = !!viewing && !!linkAccId && !!displayAcc && !linkDirty;
  const showPendingBanner = !!viewing && !!linkAccId && linkDirty && !!pendingDisplay;

  const copyId = (id: any) => {
    if (!id || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(id).catch(() => {});
  };

  if (loading) return (
    <div className="ocr-loading">
      <div className="ocr-spinner" />
      <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
    </div>
  );

  return (
    <div dir={dir}>
      {/* Toolbar */}
      <div className="inv-toolbar mb-4">
        <label className="nx-checkbox inv-select-all-wrap">
          <input type="checkbox" checked={allChecked} onChange={allChecked ? () => setSelected(new Set()) : () => setSelected(new Set(displayedSuppliers.map((s: any) => s.id)))} className="inv-toolbar-checkbox" />
          <span className="inv-select-all-label">
            {selected.size > 0 ? (isAr ? `${selected.size} محدد` : `${selected.size} selected`) : (isAr ? 'تحديد الكل' : 'Select all')}
          </span>
        </label>

        <div className="inv-search-wrap">
          <span className="inv-search-icon">⌕</span>
          <Input type="text" value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder={t('ocrSearch')} className="inv-search-input" />
          {search && <Button className="inv-search-clear" onClick={() => setSearch('')}>✕</Button>}
        </div>

        <label className="flex items-center gap-2 text-[12px] text-noorix-muted shrink-0">
          <span>{t('ocrFilterByCategory')}</span>
          <select
            className="rounded-md border border-noorix-border bg-noorix-bg-surface px-2 py-1.5 text-[12px] text-noorix-text max-w-[160px]"
            value={categoryFilter}
            onChange={(e: any) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t('ocrAllCategories')}</option>
            {OCR_SUPPLIER_CATEGORY_OPTIONS.filter((o: any) => o.value).map((opt: any) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </select>
        </label>

        <Button onClick={() => setAdding(true)} variant="primary" size="sm">+ {t('ocrAddSupplier')}</Button>

        {selected.size > 0 && (
          <Button className="inv-delete-btn" onClick={handleBulkDelete} disabled={deleting}>
            {isAr ? `حذف (${selected.size})` : `Delete (${selected.size})`}
          </Button>
        )}
      </div>

      {adding && (
        <div className="noorix-surface-card mb-4 p-5">
          <div className="font-semibold mb-3 text-[14px]">{t('ocrAddSupplier')}</div>
          <SupplierForm onSave={handleCreate} onCancel={() => setAdding(false)} loading={saving} />
        </div>
      )}

      {displayedSuppliers.length === 0 ? (
        <div className="ocr-empty">
          <div className="ocr-empty-icon">—</div>
          <div className="ocr-empty-text">{t('ocrNoSuppliers')}</div>
        </div>
      ) : (
        <div className="ocr-catalog-list">
          {displayedSuppliers.map((s: any) => (
            <div key={s.id}>
              {editing?.id === s.id ? (
                <div className="noorix-surface-card p-4">
                  <SupplierForm initial={s} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div className={`ocr-catalog-item${selected.has(s.id) ? ' ocr-catalog-item--selected' : ''}`}>
                  <label className="nx-checkbox">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="ocr-catalog-checkbox" onClick={(e: any) => e.stopPropagation()} />
                  </label>
                  <div className="ocr-catalog-avatar">{(s.nameAr || s.nameEn || '?')[0]}</div>
                  <div className="ocr-catalog-name cursor-pointer flex-1 min-w-0" onClick={() => openViewing(s)}>
                    <div className="ocr-catalog-name-primary flex items-center gap-2 flex-wrap">
                      <span>{isAr ? s.nameAr : (s.nameEn || s.nameAr)}</span>
                      {!!s.supplierCategory && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-noorix-bg-muted text-noorix-muted border border-noorix-border">
                          {ocrSupplierCategoryLabel(s.supplierCategory, t)}
                        </span>
                      )}
                      {s.accountingSupplier?.id && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: '#dcfce7', color: 'var(--noorix-accent-green)' }}
                          title={s.accountingSupplier.id}
                        >
                          {isAr ? 'محاسبة ✓' : 'Ledger ✓'}
                        </span>
                      )}
                    </div>
                    {s.nameEn && s.nameAr && <div className="ocr-catalog-name-secondary">{isAr ? s.nameEn : s.nameAr}</div>}
                    {s.accountingSupplier?.id && (
                      <div className="text-[11px] text-noorix-blue font-medium mt-0.5 truncate space-y-0.5">
                        <div>
                          {t('ocrNoorixLinked')}{' '}
                          <span className="text-noorix-text">{isAr ? (s.accountingSupplier.nameAr || s.accountingSupplier.nameEn) : (s.accountingSupplier.nameEn || s.accountingSupplier.nameAr)}</span>
                          {s.accountingSupplier.taxNumber && (
                            <span className="text-noorix-muted font-normal"> — {s.accountingSupplier.taxNumber}</span>
                          )}
                        </div>
                        <div className="font-mono text-[10px] text-noorix-muted break-all" title={s.accountingSupplier.id}>
                          ID: {s.accountingSupplier.id}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="ocr-catalog-badge">{s._count?.invoices || 0} {isAr ? 'فاتورة' : 'inv.'}</span>
                  <div className="flex gap-1 shrink-0">
                    <Button onClick={() => setEditing(s)} size="sm">{t('ocrEdit')}</Button>
                    <Button onClick={() => handleDelete(s.id)} size="sm" variant="danger">{t('ocrDelete')}</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Alias drawer + accounting link */}
      <AdaptiveSheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="md"
        side="start"
        title={viewing?.nameAr || ''}
        className="ocr-supplier-aliases-drawer"
      >
        <div dir={dir}>
          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/50 p-3 mb-4">
            <div className="font-semibold text-[13px] mb-1">{t('ocrSupplierCategory')}</div>
            <p className="text-[11px] text-noorix-muted m-0 mb-2">{t('ocrSupplierCategoryHint')}</p>
            <div className="flex flex-wrap gap-2 items-end">
              <select
                className="flex-1 min-w-[140px] rounded-md border border-noorix-border bg-noorix-bg-surface px-2 py-2 text-[13px] text-noorix-text"
                value={supplierCategoryLocal}
                onChange={(e: any) => setSupplierCategoryLocal(e.target.value)}
              >
                {OCR_SUPPLIER_CATEGORY_OPTIONS.map((opt: any) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.labelKey ? t(opt.labelKey) : '—'}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="primary" disabled={categorySaving} onClick={handleSaveSupplierCategory}>
                {categorySaving ? '…' : t('ocrSaveCategory')}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/50 p-3 mb-4">
            <div className="font-semibold text-[13px] mb-1">{t('ocrLinkNoorixSupplier')}</div>
            <p className="text-[11px] text-noorix-muted m-0 mb-2">{t('ocrLinkedNoorixHint')}</p>

            {accSuggestionsFetching && (
              <p className="text-[11px] text-noorix-muted m-0 mb-2">{t('ocrAccountingSupplierSuggestLoading')}</p>
            )}

            {linkSaveFlash && (
              <div
                className="text-[12px] font-medium rounded-md px-2 py-1.5 mb-2"
                style={{ background: '#dcfce7', color: 'var(--noorix-accent-green)' }}
              >
                {t('ocrLinkedAccountingSavedOk')}
              </div>
            )}

            {showLinkedBanner && (
              <div
                className="rounded-md border px-2 py-2 mb-2 space-y-1"
                style={{ borderColor: 'var(--noorix-accent-green)', background: 'rgba(34, 197, 94, 0.08)' }}
              >
                <div className="text-[12px] font-semibold text-noorix-text flex items-center gap-1">
                  <span aria-hidden>✓</span>
                  {t('ocrLinkedAccountingBanner')}
                </div>
                <div className="text-[13px] text-noorix-text">
                  {isAr
                    ? (displayAcc.nameAr || displayAcc.nameEn)
                    : (displayAcc.nameEn || displayAcc.nameAr)}
                  {displayAcc.taxNumber && (
                    <span className="text-noorix-muted font-normal"> — {displayAcc.taxNumber}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-noorix-muted shrink-0">{t('ocrLinkedAccountingId')}</span>
                  <code className="text-[11px] font-mono bg-noorix-bg-surface px-1.5 py-0.5 rounded border border-noorix-border break-all">
                    {linkAccId}
                  </code>
                  <Button type="button" size="sm" variant="secondary" className="text-[11px] py-0.5 h-7" onClick={() => copyId(linkAccId)}>
                    {isAr ? 'نسخ' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}

            {showPendingBanner && (
              <div
                className="rounded-md border px-2 py-2 mb-2 space-y-1"
                style={{ borderColor: 'var(--noorix-accent-amber)', background: 'var(--noorix-yellow-8)' }}
              >
                <div className="text-[12px] font-semibold" style={{ color: 'var(--noorix-accent-amber)' }}>
                  {t('ocrLinkedAccountingUnsaved')}
                </div>
                <div className="text-[12px] text-noorix-text">
                  → {isAr ? (pendingDisplay.nameAr || pendingDisplay.nameEn) : (pendingDisplay.nameEn || pendingDisplay.nameAr)}
                </div>
                <code className="text-[10px] font-mono text-noorix-muted break-all">{linkAccId}</code>
              </div>
            )}

            {accLinkSuggestions.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] text-noorix-muted mb-1">{t('ocrAccountingQuickSuggestions')}</div>
                <div className="flex flex-wrap gap-1">
                  {accLinkSuggestions.slice(0, 8).map((sug: any) => (
                    <button
                      key={sug.id}
                      type="button"
                      className={`text-[11px] rounded-full border px-2 py-1 max-w-full truncate transition-colors ${
                        linkAccId === sug.id
                          ? 'border-noorix-blue bg-noorix-blue/10 text-noorix-blue font-semibold'
                          : 'border-noorix-border bg-noorix-bg-surface text-noorix-text hover:bg-noorix-bg-muted'
                      }`}
                      onClick={() => setLinkAccId(sug.id)}
                      title={sug.id}
                    >
                      {(isAr ? sug.nameAr : sug.nameEn) || sug.nameAr || sug.nameEn || sug.id.slice(0, 10)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Input
              type="text"
              value={accSearchQuery}
              onChange={(e: any) => setAccSearchQuery(e.target.value)}
              placeholder={t('ocrAccountingSearchPlaceholder')}
              className="w-full mb-2"
            />
            <div className="flex flex-wrap gap-2 mb-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setLinkAccId('')}>
                {t('ocrAccountingClearPick')}
              </Button>
            </div>
            <div
              className="max-h-[220px] overflow-y-auto rounded-md border border-noorix-border bg-noorix-bg-surface mb-2"
              role="listbox"
              aria-label={t('ocrLinkNoorixSupplier')}
            >
              {rankedAccountingForPicker.length === 0 ? (
                <div className="text-[12px] text-noorix-muted p-3">{t('ocrAccountingSearchNoResults')}</div>
              ) : (
                rankedAccountingForPicker.map((row: any) => (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    aria-selected={linkAccId === row.id}
                    className={`w-full text-start px-3 py-2 text-[12px] border-b border-noorix-border last:border-b-0 transition-colors ${
                      linkAccId === row.id ? 'bg-noorix-blue/10 font-semibold text-noorix-text' : 'text-noorix-text hover:bg-noorix-bg-muted'
                    }`}
                    onClick={() => setLinkAccId(row.id)}
                  >
                    <div className="font-medium">
                      {(isAr ? row.nameAr : row.nameEn) || row.nameAr || row.nameEn}
                      {row.taxNumber && (
                        <span className="text-noorix-muted font-normal"> — {row.taxNumber}</span>
                      )}
                    </div>
                    <code className="text-[10px] text-noorix-muted font-mono break-all">{row.id}</code>
                  </button>
                ))
              )}
            </div>
            <Button variant="primary" size="sm" onClick={handleSaveAccountingLink} disabled={linkSaving}>
              {linkSaving ? '…' : t('ocrSaveSupplierLink')}
            </Button>
          </div>

          <p className="text-[12px] text-noorix-muted mt-0 mb-3">{t('ocrAliases')}</p>
          <div className="modal-body">
            {(viewing?.aliases || []).length === 0 && (
              <div className="text-noorix-muted text-[13px]">{isAr ? 'لا توجد أسماء بديلة بعد' : 'No aliases yet'}</div>
            )}
            <div className="flex flex-col gap-1">
              {(viewing?.aliases || []).map((a: any) => (
                <div key={a.id} className="rounded-lg bg-noorix-bg-muted text-[13px] py-2 px-3">
                  {a.alias} <span className="text-noorix-muted text-[11px]">({a.language})</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input type="text" value={aliasInput} onChange={(e: any) => setAliasInput(e.target.value)} placeholder={t('ocrAddAlias')} className="flex-1 min-w-0" />
              <Input type="select" value={aliasLang} onChange={(e: any) => setAliasLang(e.target.value)}>
                <option value="ar">AR</option>
                <option value="en">EN</option>
              </Input>
              <Button onClick={handleAddAlias} variant="primary">+</Button>
            </div>
          </div>
        </div>
      </AdaptiveSheet>
    </div>
  );
}
