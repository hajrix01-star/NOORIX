import React, { useState, useMemo, useEffect, useRef } from 'react';
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

function SupplierForm({ initial = {}, onSave, onCancel, loading }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ nameAr: '', nameEn: '', taxNumber: '', phone: '', notes: '', ...initial });
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="grid gap-3">
      <Input placeholder={`${t('ocrSupplierNameAr')} *`} value={form.nameAr} onChange={f('nameAr')} />
      <Input placeholder={t('ocrSupplierNameEn')} value={form.nameEn} onChange={f('nameEn')} />
      <Input placeholder={t('ocrSupplierTax')} value={form.taxNumber} onChange={f('taxNumber')} />
      <Input placeholder={t('ocrSupplierPhone')} value={form.phone} onChange={f('phone')} />
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={loading || !form.nameAr} variant="primary" className="flex-1 min-w-0">
          {loading ? '...' : t('ocrSave')}
        </Button>
        <Button onClick={onCancel} className="flex-1 min-w-0">{t('ocrCancel')}</Button>
      </div>
    </div>
  );
}

export default function SuppliersCatalogTab({ suppliers = [], loading, onRefresh }) {
  const { t, lang: language } = useTranslation();
  const { activeCompanyId } = useApp();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasLang, setAliasLang] = useState('ar');
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [linkAccId, setLinkAccId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkSaveFlash, setLinkSaveFlash] = useState(false);
  const [autoSuggestHint, setAutoSuggestHint] = useState(false);
  const prevDrawerSupplierIdRef = useRef(null);
  const autoSuggestDoneRef = useRef(false);
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

  useEffect(() => {
    if (!viewing) {
      prevDrawerSupplierIdRef.current = null;
      return;
    }
    if (prevDrawerSupplierIdRef.current !== viewing.id) {
      prevDrawerSupplierIdRef.current = viewing.id;
      autoSuggestDoneRef.current = false;
    }
  }, [viewing]);

  useEffect(() => {
    if (!viewing?.id) return;
    if (viewing.accountingSupplier?.id) return;
    if (linkAccId) return;
    if (autoSuggestDoneRef.current) return;
    const top = accLinkSuggestions[0];
    if (!top?.id) return;
    const ms = top.matchScore ?? 0;
    const pick =
      !!top.linkedFromOcr ||
      ms >= 100 ||
      (ms >= 80 && accLinkSuggestions.length === 1) ||
      (ms >= 72 && (accLinkSuggestions[1]?.matchScore ?? 0) < ms - 15);
    if (!pick) return;
    setLinkAccId(top.id);
    autoSuggestDoneRef.current = true;
    setAutoSuggestHint(true);
  }, [viewing, linkAccId, accLinkSuggestions]);

  const toggleSelect = (id) => setSelected((prev) => {
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

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.nameAr?.toLowerCase().includes(q) || s.nameEn?.toLowerCase().includes(q) || s.taxNumber?.includes(q);
  });

  const handleCreate = async (data) => {
    setSaving(true);
    try {
      const res = await createOcrSupplier(data);
      assertApiOk(res, t('saveFailed'));
      setAdding(false);
      onRefresh();
    } catch (e) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data) => {
    setSaving(true);
    try {
      const res = await updateOcrSupplier(editing.id, data);
      assertApiOk(res, t('saveFailed'));
      setEditing(null);
      onRefresh();
    } catch (e) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل تريد حذف هذا المورد؟')) return;
    await deleteOcrSupplier(id);
    onRefresh();
  };

  const handleAddAlias = async () => {
    if (!aliasInput || !viewing) return;
    await addSupplierAlias(viewing.id, aliasInput, aliasLang);
    setAliasInput('');
    onRefresh();
    const updated = suppliers.find((s) => s.id === viewing.id);
    if (updated) setViewing(updated);
  };

  const openViewing = (s) => {
    setViewing(s);
    setLinkAccId(s.accountingSupplier?.id || '');
    setLinkSaveFlash(false);
    setAutoSuggestHint(false);
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
      setAutoSuggestHint(false);
      setLinkSaveFlash(true);
      window.setTimeout(() => setLinkSaveFlash(false), 5000);
    } catch (e) {
      alert(e?.message || t('saveFailed'));
    } finally {
      setLinkSaving(false);
    }
  };

  const isAr = language === 'ar';
  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const accOptions = useMemo(
    () => [...accountingSuppliers].sort((a, b) => (a.nameAr || '').localeCompare(b.nameAr || '', 'ar')),
    [accountingSuppliers],
  );

  const selectedAccRow = useMemo(
    () => accOptions.find((a) => a.id === linkAccId) || null,
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
      accLinkSuggestions.find((x) => x.id === linkAccId) ||
      null,
    [selectedAccRow, accLinkSuggestions, linkAccId],
  );

  const savedAccId = viewing?.accountingSupplier?.id || '';
  const linkDirty = !!viewing && (linkAccId || '') !== (savedAccId || '');
  const showLinkedBanner = !!viewing && !!linkAccId && !!displayAcc && !linkDirty;
  const showPendingBanner = !!viewing && !!linkAccId && linkDirty && !!pendingDisplay;

  const copyId = (id) => {
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
          <input type="checkbox" checked={allChecked} onChange={allChecked ? () => setSelected(new Set()) : () => setSelected(new Set(filtered.map(s => s.id)))} className="inv-toolbar-checkbox" />
          <span className="inv-select-all-label">
            {selected.size > 0 ? (isAr ? `${selected.size} محدد` : `${selected.size} selected`) : (isAr ? 'تحديد الكل' : 'Select all')}
          </span>
        </label>

        <div className="inv-search-wrap">
          <span className="inv-search-icon">⌕</span>
          <Input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ocrSearch')} className="inv-search-input" />
          {search && <Button className="inv-search-clear" onClick={() => setSearch('')}>✕</Button>}
        </div>

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

      {filtered.length === 0 ? (
        <div className="ocr-empty">
          <div className="ocr-empty-icon">—</div>
          <div className="ocr-empty-text">{t('ocrNoSuppliers')}</div>
        </div>
      ) : (
        <div className="ocr-catalog-list">
          {filtered.map((s) => (
            <div key={s.id}>
              {editing?.id === s.id ? (
                <div className="noorix-surface-card p-4">
                  <SupplierForm initial={s} onSave={handleUpdate} onCancel={() => setEditing(null)} loading={saving} />
                </div>
              ) : (
                <div className={`ocr-catalog-item${selected.has(s.id) ? ' ocr-catalog-item--selected' : ''}`}>
                  <label className="nx-checkbox">
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="ocr-catalog-checkbox" onClick={e => e.stopPropagation()} />
                  </label>
                  <div className="ocr-catalog-avatar">{(s.nameAr || s.nameEn || '?')[0]}</div>
                  <div className="ocr-catalog-name cursor-pointer flex-1 min-w-0" onClick={() => openViewing(s)}>
                    <div className="ocr-catalog-name-primary flex items-center gap-2 flex-wrap">
                      <span>{isAr ? s.nameAr : (s.nameEn || s.nameAr)}</span>
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

            {autoSuggestHint && !savedAccId && linkAccId && (
              <p className="text-[11px] text-noorix-muted m-0 mb-2">{t('ocrAutoLinkSuggestionHint')}</p>
            )}

            <select
              className="w-full rounded-md border border-noorix-border bg-noorix-bg-surface px-2 py-2 text-[13px] text-noorix-text mb-2"
              value={linkAccId}
              onChange={(e) => setLinkAccId(e.target.value)}
            >
              <option value="">{isAr ? '— بدون ربط —' : '— No link —'}</option>
              {accOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.nameAr || '') + (a.taxNumber ? ` — ${a.taxNumber}` : '')}
                </option>
              ))}
            </select>
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
              {(viewing?.aliases || []).map((a) => (
                <div key={a.id} className="rounded-lg bg-noorix-bg-muted text-[13px] py-2 px-3">
                  {a.alias} <span className="text-noorix-muted text-[11px]">({a.language})</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder={t('ocrAddAlias')} className="flex-1 min-w-0" />
              <Input type="select" value={aliasLang} onChange={(e) => setAliasLang(e.target.value)}>
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
