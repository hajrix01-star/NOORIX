/**
 * مطابق CategoryTreeManager.jsx + CategoryCard + CategoryFormDialog في Base44
 * (بدون استيراد من شركة أخرى — لا يوجد API مطابق)
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  bankStatementTreeCategoriesList,
  bankStatementTreeCategoryCreate,
  bankStatementTreeCategoryUpdate,
  bankStatementTreeCategoryDelete,
  bankStatementTreeCategoriesSeedDefaults,
  bankStatementClassificationRulesList,
} from '../../../services/api';
import { TRANSACTION_TYPES, TRANSACTION_SIDES, getTransactionTypeInfo, getTransactionSideInfo } from './bankRuleConstants';

const inputStyle = { width: '100%', marginTop: 4, padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--noorix-border)' };
const labelMuted = { fontSize: 12, color: 'var(--noorix-text-muted)' };

function normParentKeywords(v) {
  if (!v) return [];
  return Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : [];
}

function normClassifications(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    name: String(c?.name || ''),
    keywords: Array.isArray(c?.keywords) ? c.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean) : [],
  }));
}

function CategoryFormModal({ open, onClose, category, existingCategories, companyId, showToast, t }) {
  const qc = useQueryClient();
  const EMPTY = { name: '', keywords: [] };
  const [name, setName] = useState('');
  const [parentKeywords, setParentKeywords] = useState([]);
  const [newParentKeyword, setNewParentKeyword] = useState('');
  const [transactionType, setTransactionType] = useState('expense');
  const [transactionSide, setTransactionSide] = useState('any');
  const [sortOrder, setSortOrder] = useState(100);
  const [classifications, setClassifications] = useState([{ ...EMPTY }]);
  const [newKeyword, setNewKeyword] = useState('');
  const [activeClassIdx, setActiveClassIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name || '');
      setParentKeywords(normParentKeywords(category.parentKeywords));
      setTransactionType(category.transactionType || 'expense');
      setTransactionSide(category.transactionSide || 'any');
      setSortOrder(category.sortOrder ?? 100);
      const cls = normClassifications(category.classifications);
      setClassifications(cls.length ? cls : [{ ...EMPTY }]);
    } else {
      const maxOrder = (existingCategories || []).reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0);
      setName('');
      setParentKeywords([]);
      setTransactionType('expense');
      setTransactionSide('any');
      setSortOrder(maxOrder + 10);
      setClassifications([{ ...EMPTY }]);
    }
    setActiveClassIdx(0);
    setNewKeyword('');
    setNewParentKeyword('');
  }, [open, category, existingCategories]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['bank-tree-categories', companyId] });

  const createMut = useMutation({
    mutationFn: async (body) => {
      const res = await bankStatementTreeCategoryCreate(body);
      if (!res?.success) throw new Error(res?.error || 'create');
      return res;
    },
    onSuccess: () => {
      invalidate();
      showToast?.(t('savedSuccessfully') || 'OK');
      onClose();
    },
    onError: (e) => showToast?.(e?.message || 'Error', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await bankStatementTreeCategoryUpdate(companyId, id, patch);
      if (!res?.success) throw new Error(res?.error || 'update');
      return res;
    },
    onSuccess: () => {
      invalidate();
      showToast?.(t('savedSuccessfully') || 'OK');
      onClose();
    },
    onError: (e) => showToast?.(e?.message || 'Error', 'error'),
  });

  const handleSave = () => {
    if (!name.trim()) {
      showToast?.(t('bankTreeCategoryNameRequired'), 'error');
      return;
    }
    const cleanClassifications = classifications
      .filter((c) => c.name?.trim() || (c.keywords && c.keywords.length))
      .map((c) => ({
        name: (c.name || '').trim() || t('bankTreeUnnamedClassification'),
        keywords: (c.keywords || []).filter(Boolean),
      }));
    if (!cleanClassifications.length || cleanClassifications.every((c) => !c.keywords.length)) {
      showToast?.(t('bankTreeClassificationKeywordsRequired'), 'error');
      return;
    }
    const payload = {
      companyId,
      name: name.trim(),
      sortOrder: parseInt(String(sortOrder), 10) || 100,
      transactionSide,
      transactionType: transactionType || null,
      parentKeywords: parentKeywords.filter(Boolean),
      classifications: cleanClassifications,
    };
    if (category?.id) {
      updateMut.mutate({ id: category.id, patch: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const addParentKw = () => {
    const kw = newParentKeyword.trim().toLowerCase();
    if (!kw || parentKeywords.includes(kw)) return;
    setParentKeywords((p) => [...p, kw]);
    setNewParentKeyword('');
  };

  const addKw = (classIdx) => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;
    const cl = classifications[classIdx];
    if (cl.keywords?.includes(kw)) {
      showToast?.(t('bankTreeDuplicateKeyword'), 'error');
      return;
    }
    setClassifications((prev) =>
      prev.map((c, i) => (i === classIdx ? { ...c, keywords: [...(c.keywords || []), kw] } : c)),
    );
    setNewKeyword('');
  };

  if (!open) return null;
  const pending = createMut.isPending || updateMut.isPending;

  return (
    <div
      className="noorix-modal-backdrop"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="noorix-surface-card" style={{ width: 'min(640px, 96vw)', maxHeight: '88vh', overflow: 'auto', padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{category ? t('bankTreeEditCategory') : t('bankTreeAddCategory')}</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
            <label>
              <span style={labelMuted}>{t('bankTreeCategoryName')} *</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </label>
            <label>
              <span style={labelMuted}>{t('bankTreeSortOrder')}</span>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={inputStyle} min={1} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label>
              <span style={labelMuted}>{t('bankTreeTransactionType')}</span>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} style={inputStyle}>
                {TRANSACTION_TYPES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.icon} {t(x.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={labelMuted}>{t('bankTreeTransactionSide')}</span>
              <select value={transactionSide} onChange={(e) => setTransactionSide(e.target.value)} style={inputStyle}>
                {TRANSACTION_SIDES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.icon} {t(s.labelKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(217,119,6,0.35)', background: 'rgba(254,243,199,0.35)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('bankTreeParentKeywords')}</div>
            <p style={{ fontSize: 11, color: 'var(--noorix-text-muted)', margin: '0 0 8px' }}>{t('bankTreeParentKeywordsHint')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {parentKeywords.map((kw, idx) => (
                <span key={idx} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fff', border: '1px solid var(--noorix-border)' }}>
                  {kw}
                  <button type="button" onClick={() => setParentKeywords((p) => p.filter((_, i) => i !== idx))} style={{ marginInlineStart: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#b91c1c' }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={newParentKeyword} onChange={(e) => setNewParentKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParentKw())} placeholder="…" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
              <button type="button" className="noorix-btn noorix-btn--ghost" onClick={addParentKw}>
                +
              </button>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>{t('bankTreeSubClassifications')}</span>
              <button
                type="button"
                className="noorix-btn noorix-btn--ghost"
                onClick={() => {
                  setClassifications((p) => [...p, { ...EMPTY }]);
                  setActiveClassIdx(classifications.length);
                }}
              >
                + {t('bankTreeAddSub')}
              </button>
            </div>
            {classifications.map((cl, idx) => (
              <div
                key={idx}
                onClick={() => setActiveClassIdx(idx)}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  borderRadius: 10,
                  border: activeClassIdx === idx ? '2px solid rgba(37,99,235,0.45)' : '1px solid var(--noorix-border)',
                  background: activeClassIdx === idx ? 'rgba(37,99,235,0.06)' : 'var(--noorix-bg-muted)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={cl.name}
                    onChange={(e) => setClassifications((p) => p.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c)))}
                    placeholder={t('bankTreeSubNamePlaceholder')}
                    style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                  />
                  {classifications.length > 1 ? (
                    <button
                      type="button"
                      className="noorix-btn noorix-btn--ghost"
                      style={{ color: '#dc2626' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClassifications((p) => p.filter((_, i) => i !== idx));
                        setActiveClassIdx(0);
                      }}
                    >
                      {t('delete')}
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {(cl.keywords || []).map((kw, kwIdx) => (
                    <span key={kwIdx} style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, background: '#fff', border: '1px solid var(--noorix-border)' }}>
                      {kw}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClassifications((p) =>
                            p.map((c, i) => (i === idx ? { ...c, keywords: c.keywords.filter((_, ki) => ki !== kwIdx) } : c)),
                          );
                        }}
                        style={{ marginInlineStart: 4, border: 'none', background: 'none', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {activeClassIdx === idx ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKw(idx))}
                      style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                      placeholder={t('bankTreeAddKeywordPlaceholder')}
                    />
                    <button type="button" className="noorix-btn noorix-btn--primary" onClick={() => addKw(idx)} disabled={!newKeyword.trim()}>
                      +
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="noorix-btn noorix-btn--primary" onClick={handleSave} disabled={pending}>
            {pending ? t('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryCardRow({ category, index, t, onEdit, onDelete, onToggle }) {
  const typeInfo = getTransactionTypeInfo(category.transactionType, t);
  const sideInfo = getTransactionSideInfo(category.transactionSide, t);
  const classifications = normClassifications(category.classifications);
  const parentKeywords = normParentKeywords(category.parentKeywords);
  const totalKw = classifications.reduce((s, c) => s + (c.keywords?.length || 0), 0);
  const active = category.isActive !== false;

  return (
    <div className="noorix-surface-card" style={{ padding: 14, opacity: active ? 1 : 0.55 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {index != null ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#fff',
                  background: 'linear-gradient(135deg,#1e3a5f,#0a1628)',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {index}
              </span>
            ) : null}
            <span style={{ fontWeight: 700 }}>{category.name}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: typeInfo.color, color: typeInfo.colorText }}>
              {typeInfo.icon} {typeInfo.label}
            </span>
            {category.transactionSide && category.transactionSide !== 'any' ? (
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--noorix-border)',
                  background: category.transactionSide === 'debit' ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
                }}
              >
                {sideInfo.icon} {t(sideInfo.labelKey)}
              </span>
            ) : null}
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--noorix-bg-muted)' }}>
              {classifications.length} {t('bankTreeStatsClassifications')} · {totalKw} {t('bankTreeStatsKeywords')}
            </span>
          </div>
          {parentKeywords.length > 0 ? (
            <div style={{ fontSize: 11, marginBottom: 8, color: '#b45309' }}>
              {t('bankTreeParentKeywordsShort')}: {parentKeywords.join(' · ')}
            </div>
          ) : null}
          {classifications.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {classifications.map((cl, idx) => (
                <div key={idx} style={{ fontSize: 12, paddingLeft: 8, borderLeft: '2px solid var(--noorix-border)' }}>
                  <strong>{cl.name}</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {(cl.keywords || []).map((kw, ki) => (
                      <code key={ki} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--noorix-bg-muted)' }}>
                        {kw}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={() => onToggle()} />
            {t('bankTreeActive')}
          </label>
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={onEdit}>
            {t('edit')}
          </button>
          <button type="button" className="noorix-btn noorix-btn--ghost" style={{ color: '#dc2626' }} onClick={onDelete}>
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BankCategoryTreePanel({ companyId, showToast }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showMigrate, setShowMigrate] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const qKey = ['bank-tree-categories', companyId];
  const { data: categories = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      const res = await bankStatementTreeCategoriesList(companyId);
      if (!res.success) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: flatRules = [] } = useQuery({
    queryKey: ['bank-classification-rules', companyId],
    queryFn: async () => {
      const res = await bankStatementClassificationRulesList(companyId);
      if (!res.success) throw new Error(res.error);
      return res.data ?? [];
    },
    enabled: !!companyId,
  });

  const activeFlat = useMemo(() => (flatRules || []).filter((r) => r.isActive !== false), [flatRules]);

  const sortedCategories = useMemo(
    () => [...categories].filter((c) => c.isActive !== false).sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100)),
    [categories],
  );
  const inactiveCategories = useMemo(() => categories.filter((c) => c.isActive === false), [categories]);

  const totalKeywords = useMemo(() => {
    return categories.reduce((sum, c) => {
      const cls = normClassifications(c.classifications);
      return sum + cls.reduce((s, cl) => s + (cl.keywords?.length || 0), 0);
    }, 0);
  }, [categories]);
  const totalClassifications = useMemo(() => {
    return categories.reduce((sum, c) => sum + normClassifications(c.classifications).length, 0);
  }, [categories]);

  const deleteMut = useMutation({
    mutationFn: (id) => bankStatementTreeCategoryDelete(companyId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey });
      showToast?.(t('deletedSuccessfully') || 'OK');
    },
    onError: (e) => showToast?.(e?.message || 'Error', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }) => bankStatementTreeCategoryUpdate(companyId, id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    onError: (e) => showToast?.(e?.message || 'Error', 'error'),
  });

  const seedDefaultsMut = useMutation({
    mutationFn: async () => {
      const res = await bankStatementTreeCategoriesSeedDefaults(companyId);
      if (!res?.success) throw new Error(res?.error || 'seed');
      return res.data ?? res;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qKey });
      const n = data?.created ?? 8;
      showToast?.(t('bankTreeSeedDefaultsDone', String(n)));
    },
    onError: (e) => showToast?.(e?.message || t('bankTreeSeedDefaultsError'), 'error'),
  });

  const groupedForMigrate = useMemo(() => {
    const groups = {};
    for (const rule of activeFlat) {
      const cat = rule.categoryName || t('bankTreeUncategorized');
      if (!groups[cat]) {
        groups[cat] = {
          categoryName: cat,
          transactionType: rule.transactionType || null,
          transactionSide: rule.transactionSide || 'any',
          keywords: [],
        };
      }
      if (rule.keyword) groups[cat].keywords.push(String(rule.keyword).toLowerCase());
    }
    return Object.values(groups);
  }, [activeFlat, t]);

  const runMigrate = async () => {
    setMigrating(true);
    try {
      let order = 10;
      for (const group of groupedForMigrate) {
        const tt = group.transactionType && group.transactionType !== 'unknown' ? group.transactionType : null;
        const res = await bankStatementTreeCategoryCreate({
          companyId,
          name: group.categoryName,
          sortOrder: order,
          transactionSide: group.transactionSide || 'any',
          transactionType: tt,
          parentKeywords: [],
          classifications: [{ name: group.categoryName, keywords: [...new Set(group.keywords)] }],
        });
        if (res?.success === false) throw new Error(res.error || 'migrate');
        order += 10;
      }
      await qc.invalidateQueries({ queryKey: qKey });
      await qc.invalidateQueries({ queryKey: ['bank-classification-rules', companyId] });
      showToast?.(t('bankTreeMigrateDone', String(groupedForMigrate.length)));
      setShowMigrate(false);
    } catch (e) {
      showToast?.(e?.message || 'Error', 'error');
    } finally {
      setMigrating(false);
    }
  };

  const openNew = useCallback(() => {
    setEditing(null);
    setShowForm(true);
  }, []);
  const openEdit = useCallback((cat) => {
    setEditing(cat);
    setShowForm(true);
  }, []);

  if (!companyId) return null;

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
      <div className="noorix-surface-card" style={{ padding: 12, marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeStatsCategories')}</span>
        <strong>{sortedCategories.length}</strong>
        <span style={{ color: 'var(--noorix-border)' }}>|</span>
        <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeStatsClassifications')}</span>
        <strong style={{ color: '#1d4ed8' }}>{totalClassifications}</strong>
        <span style={{ color: 'var(--noorix-border)' }}>|</span>
        <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeStatsKeywords')}</span>
        <strong style={{ color: '#15803d' }}>{totalKeywords}</strong>
        {inactiveCategories.length > 0 ? (
          <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>
            ({t('bankTreeInactiveCount', String(inactiveCategories.length))})
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button type="button" className="noorix-btn noorix-btn--primary" onClick={openNew}>
          + {t('bankTreeAddCategory')}
        </button>
        {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
          <button
            type="button"
            className="noorix-btn noorix-btn--secondary"
            disabled={seedDefaultsMut.isPending}
            onClick={() => seedDefaultsMut.mutate()}
          >
            {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
          </button>
        ) : null}
        {activeFlat.length > 0 && categories.length === 0 ? (
          <button type="button" className="noorix-btn noorix-btn--ghost" onClick={() => setShowMigrate(true)}>
            {t('bankTreeMigrateOldRules', String(activeFlat.length))}
          </button>
        ) : null}
      </div>

      {isLoading ? <p style={{ color: 'var(--noorix-text-muted)' }}>{t('loading')}…</p> : null}

      {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
        <div className="noorix-surface-card" style={{ padding: 40, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌳</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('bankTreeEmptyTitle')}</div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>{t('bankTreeEmptyDesc')}</div>
          <p style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 16, maxWidth: 420, marginInline: 'auto' }}>
            {t('bankTreeSeedDefaultsHint')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            <button type="button" className="noorix-btn noorix-btn--primary" onClick={openNew}>
              {t('bankTreeCreateFirst')}
            </button>
            <button
              type="button"
              className="noorix-btn noorix-btn--secondary"
              disabled={seedDefaultsMut.isPending}
              onClick={() => seedDefaultsMut.mutate()}
            >
              {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {sortedCategories.map((cat, idx) => (
          <CategoryCardRow
            key={cat.id}
            category={cat}
            index={idx + 1}
            t={t}
            onEdit={() => openEdit(cat)}
            onDelete={() => {
              if (window.confirm(t('bankTreeDeleteConfirm'))) deleteMut.mutate(cat.id);
            }}
            onToggle={() => updateMut.mutate({ id: cat.id, patch: { isActive: !cat.isActive } })}
          />
        ))}
      </div>

      {inactiveCategories.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeInactiveSection', String(inactiveCategories.length))}</h4>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {inactiveCategories.map((cat) => (
              <CategoryCardRow
                key={cat.id}
                category={cat}
                t={t}
                onEdit={() => openEdit(cat)}
                onDelete={() => {
                  if (window.confirm(t('bankTreeDeleteConfirm'))) deleteMut.mutate(cat.id);
                }}
                onToggle={() => updateMut.mutate({ id: cat.id, patch: { isActive: true } })}
              />
            ))}
          </div>
        </div>
      ) : null}

      <CategoryFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        category={editing}
        existingCategories={categories}
        companyId={companyId}
        showToast={showToast}
        t={t}
      />

      {showMigrate ? (
        <div
          className="noorix-modal-backdrop"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
          onClick={(e) => e.target === e.currentTarget && !migrating && setShowMigrate(false)}
        >
          <div className="noorix-surface-card" style={{ padding: 22, maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{t('bankTreeMigrateTitle')}</h3>
            <p style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeMigrateBody', String(activeFlat.length), String(groupedForMigrate.length))}</p>
            <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 12, display: 'grid', gap: 8 }}>
              {groupedForMigrate.map((g, i) => (
                <div key={i} style={{ padding: 8, borderRadius: 8, background: 'var(--noorix-bg-muted)', fontSize: 12 }}>
                  <strong>{g.categoryName}</strong> — {g.keywords.slice(0, 6).join(', ')}
                  {g.keywords.length > 6 ? '…' : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button type="button" className="noorix-btn noorix-btn--ghost" disabled={migrating} onClick={() => setShowMigrate(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="noorix-btn noorix-btn--primary" disabled={migrating} onClick={runMigrate}>
                {migrating ? t('loading') : t('bankTreeMigrateRun')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
