/**
 * مطابق CategoryTreeManager.jsx + CategoryCard + CategoryFormDialog في Base44
 * + تصدير/استيراد حزمة القواعد (فئات شجرية + قواعد مسطّحة) من ملف أو من شركة أخرى.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import {
  bankStatementTreeCategoriesList,
  bankStatementTreeCategoryCreate,
  bankStatementTreeCategoryUpdate,
  bankStatementTreeCategoryDelete,
  bankStatementTreeCategoriesSeedDefaults,
  bankStatementClassificationRulesList,
  bankStatementClassificationRulesExportPack,
  bankStatementClassificationRulesImportPack,
  bankStatementClassificationRulesImportFromCompany,
} from '../../../services/api';
import { TRANSACTION_TYPES, TRANSACTION_SIDES, getTransactionTypeInfo, getTransactionSideInfo } from './bankRuleConstants';

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

  const pending = createMut.isPending || updateMut.isPending;

  return (
    <AdaptiveSheet
      open={open}
      onClose={onClose}
      size="lg"
      side="start"
      title={category ? t('bankTreeEditCategory') : t('bankTreeAddCategory')}
      className="bank-category-form-drawer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSave} disabled={pending}>{pending ? t('loading') : t('save')}</Button>
        </>
      }
    >
      <div className="nx-grid nx-gap-14">
        <div className="nx-grid nx-gap-10" style={{ gridTemplateColumns: '1fr 100px' }}>
          <Input type="text" label={`${t('bankTreeCategoryName')} *`} value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" label={t('bankTreeSortOrder')} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} min={1} />
        </div>
        <div className="nx-grid-2 nx-gap-10">
          <Input type="select" label={t('bankTreeTransactionType')} value={transactionType} onChange={(e) => setTransactionType(e.target.value)}>
            {TRANSACTION_TYPES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.icon} {t(x.labelKey)}
              </option>
            ))}
          </Input>
          <Input type="select" label={t('bankTreeTransactionSide')} value={transactionSide} onChange={(e) => setTransactionSide(e.target.value)}>
            {TRANSACTION_SIDES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.icon} {t(s.labelKey)}
              </option>
            ))}
          </Input>
        </div>

        <div className="nx-p-12" style={{ borderRadius: 10, border: '1px solid rgba(217,119,6,0.35)', background: 'rgba(254,243,199,0.35)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('bankTreeParentKeywords')}</div>
          <p style={{ fontSize: 11, color: 'var(--noorix-text-muted)', margin: '0 0 8px' }}>{t('bankTreeParentKeywordsHint')}</p>
          <div className="nx-flex-wrap nx-gap-6 nx-mb-8">
            {parentKeywords.map((kw, idx) => (
              <span key={idx} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)' }}>
                {kw}
                <Button variant="ghost" size="sm" onClick={() => setParentKeywords((p) => p.filter((_, i) => i !== idx))} style={{ marginInlineStart: 6, color: 'var(--noorix-accent-red)', padding: '0 4px', minHeight: 'auto' }}>
                  ×
                </Button>
              </span>
            ))}
          </div>
          <div className="nx-flex nx-gap-6">
            <div className="nx-flex-1">
              <Input type="text" value={newParentKeyword} onChange={(e) => setNewParentKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParentKw())} placeholder="…" />
            </div>
            <Button onClick={addParentKw}>+</Button>
          </div>
        </div>

        <div>
          <div className="nx-flex-between nx-mb-8">
            <span className="nx-font-600">{t('bankTreeSubClassifications')}</span>
            <Button
              onClick={() => {
                setClassifications((p) => [...p, { ...EMPTY }]);
                setActiveClassIdx(classifications.length);
              }}
            >
              + {t('bankTreeAddSub')}
            </Button>
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
              <div className="nx-flex nx-gap-8 nx-mb-8">
                <div className="nx-flex-1">
                  <Input
                    type="text"
                    value={cl.name}
                    onChange={(e) => setClassifications((p) => p.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c)))}
                    placeholder={t('bankTreeSubNamePlaceholder')}
                  />
                </div>
                {classifications.length > 1 ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClassifications((p) => p.filter((_, i) => i !== idx));
                      setActiveClassIdx(0);
                    }}
                  >
                    {t('delete')}
                  </Button>
                ) : null}
              </div>
              <div className="nx-flex-wrap nx-gap-6 nx-mb-8">
                {(cl.keywords || []).map((kw, kwIdx) => (
                  <span key={kwIdx} style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 6, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)' }}>
                    {kw}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClassifications((p) =>
                          p.map((c, i) => (i === idx ? { ...c, keywords: c.keywords.filter((_, ki) => ki !== kwIdx) } : c)),
                        );
                      }}
                      style={{ marginInlineStart: 4, padding: '0 4px', minHeight: 'auto' }}
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
              {activeClassIdx === idx ? (
                <div className="nx-flex nx-gap-6">
                  <div className="nx-flex-1">
                    <Input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKw(idx))}
                      placeholder={t('bankTreeAddKeywordPlaceholder')}
                    />
                  </div>
                  <Button variant="primary" onClick={() => addKw(idx)} disabled={!newKeyword.trim()}>+</Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AdaptiveSheet>
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
    <div className="noorix-surface-card nx-p-14" style={{ opacity: active ? 1 : 0.55 }}>
        <div className="nx-flex nx-gap-12 nx-flex-wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="nx-flex-1" style={{ minWidth: 0 }}>
          <div className="nx-flex-center nx-flex-wrap nx-gap-8 nx-mb-8">
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
            <div style={{ fontSize: 11, marginBottom: 8, color: 'var(--noorix-accent-amber)' }}>
              {t('bankTreeParentKeywordsShort')}: {parentKeywords.join(' · ')}
            </div>
          ) : null}
          {classifications.length > 0 ? (
            <div className="nx-grid nx-gap-6">
              {classifications.map((cl, idx) => (
                <div key={idx} className="nx-text-sm" style={{ paddingLeft: 8, borderLeft: '2px solid var(--noorix-border)' }}>
                  <strong>{cl.name}</strong>
                  <div className="nx-flex-wrap nx-gap-4 nx-mt-4">
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
        <div className="nx-flex-col nx-gap-6 nx-flex-shrink-0" style={{ alignItems: 'flex-end' }}>
          <label className="nx-checkbox">
            <input type="checkbox" checked={active} onChange={() => onToggle()} />
            {t('bankTreeActive')}
          </label>
          <Button size="sm" onClick={onEdit}>{t('edit')}</Button>
          <Button variant="danger" size="sm" onClick={onDelete}>{t('delete')}</Button>
        </div>
      </div>
    </div>
  );
}

export default function BankCategoryTreePanel({ companyId, companies = [], showToast }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showMigrate, setShowMigrate] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState('company');
  const [importMode, setImportMode] = useState('merge');
  const [importSourceCompanyId, setImportSourceCompanyId] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const otherCompanies = useMemo(
    () => (companies || []).filter((c) => c.id && c.id !== companyId),
    [companies, companyId],
  );

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

  const invalidateRulesQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['bank-tree-categories', companyId] });
    qc.invalidateQueries({ queryKey: ['bank-classification-rules', companyId] });
  }, [qc, companyId]);

  const handleExportRules = async () => {
    setExportBusy(true);
    try {
      const res = await bankStatementClassificationRulesExportPack(companyId);
      if (!res.success) throw new Error(res.error || 'export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noorix-bank-rules-${String(companyId).slice(-8)}-${new Date().toISOString().slice(0, 10)}.json`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast?.(t('bankRulesExportDone'));
    } catch (e) {
      showToast?.(e?.message || 'Error', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const openImportModal = () => {
    const hasOthers = otherCompanies.length > 0;
    setImportSource(hasOthers ? 'company' : 'file');
    setImportMode('merge');
    setImportFile(null);
    setImportSourceCompanyId(otherCompanies[0]?.id || '');
    setShowImportModal(true);
  };

  const runPackImport = async () => {
    if (importMode === 'replace' && !window.confirm(t('bankRulesImportReplaceConfirm'))) return;
    setImportBusy(true);
    try {
      let res;
      if (importSource === 'company') {
        if (!importSourceCompanyId) {
          showToast?.(t('bankRulesSelectCompany'), 'error');
          return;
        }
        res = await bankStatementClassificationRulesImportFromCompany(companyId, importSourceCompanyId, importMode);
      } else {
        if (!importFile) {
          showToast?.(t('bankRulesPickFile'), 'error');
          return;
        }
        const text = await importFile.text();
        let pack;
        try {
          pack = JSON.parse(text);
        } catch {
          throw new Error(t('bankRulesInvalidFile'));
        }
        res = await bankStatementClassificationRulesImportPack(companyId, pack, importMode);
      }
      if (!res.success) throw new Error(res.error || 'import');
      const d = res.data ?? res;
      showToast?.(
        t(
          'bankRulesImportDone',
          String(d.treeCreated ?? 0),
          String(d.treeSkipped ?? 0),
          String(d.rulesCreated ?? 0),
          String(d.rulesSkipped ?? 0),
        ),
      );
      setShowImportModal(false);
      setImportFile(null);
      invalidateRulesQueries();
    } catch (e) {
      showToast?.(e?.message || 'Error', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <div className="nx-p-16" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="noorix-surface-card nx-flex-center nx-flex-wrap nx-gap-12 nx-p-12 nx-mb-12">
        <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeStatsCategories')}</span>
        <strong>{sortedCategories.length}</strong>
        <span style={{ color: 'var(--noorix-border)' }}>|</span>
        <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeStatsClassifications')}</span>
        <strong style={{ color: 'var(--noorix-accent-blue)' }}>{totalClassifications}</strong>
        <span style={{ color: 'var(--noorix-border)' }}>|</span>
        <span style={{ fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('bankTreeStatsKeywords')}</span>
        <strong style={{ color: 'var(--noorix-accent-green)' }}>{totalKeywords}</strong>
        {inactiveCategories.length > 0 ? (
          <span style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>
            ({t('bankTreeInactiveCount', String(inactiveCategories.length))})
          </span>
        ) : null}
      </div>

      <div className="nx-toolbar nx-mb-16">
        <Button variant="primary" onClick={openNew}>+ {t('bankTreeAddCategory')}</Button>
        {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
          <Button disabled={seedDefaultsMut.isPending} onClick={() => seedDefaultsMut.mutate()}>
            {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
          </Button>
        ) : null}
        {activeFlat.length > 0 && categories.length === 0 ? (
          <Button onClick={() => setShowMigrate(true)}>{t('bankTreeMigrateOldRules', String(activeFlat.length))}</Button>
        ) : null}
        <Button disabled={exportBusy} onClick={handleExportRules}>{exportBusy ? '…' : t('bankRulesExport')}</Button>
        <Button onClick={openImportModal}>{t('bankRulesImport')}</Button>
      </div>

      {isLoading ? <p className="nx-text-muted">{t('loading')}…</p> : null}

      {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
        <div className="noorix-surface-card nx-text-center nx-text-muted nx-p-24">
          <div className="nx-mb-12 nx-text-3xl"></div>
          <div className="nx-font-600 nx-mb-6">{t('bankTreeEmptyTitle')}</div>
          <div className="nx-text-base nx-mb-8">{t('bankTreeEmptyDesc')}</div>
          <p className="nx-text-sm nx-text-muted nx-mb-16" style={{ maxWidth: 420, marginInline: 'auto' }}>
            {t('bankTreeSeedDefaultsHint')}
          </p>
          <div className="nx-flex-wrap nx-gap-10 nx-text-center" style={{ justifyContent: 'center' }}>
            <Button variant="primary" onClick={openNew}>{t('bankTreeCreateFirst')}</Button>
            <Button disabled={seedDefaultsMut.isPending} onClick={() => seedDefaultsMut.mutate()}>
              {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="nx-grid nx-gap-10">
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
        <div className="nx-mt-20">
          <h4 className="nx-text-base nx-text-muted">{t('bankTreeInactiveSection', String(inactiveCategories.length))}</h4>
          <div className="nx-grid nx-gap-10 nx-mt-10">
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

      <AdaptiveSheet
        open={showMigrate}
        onClose={() => !migrating && setShowMigrate(false)}
        title={t('bankTreeMigrateTitle')}
        size="md"
        side="start"
        className="bank-tree-migrate-drawer"
        closeOnBackdrop={!migrating}
        footer={
          <>
            <Button variant="ghost" disabled={migrating} onClick={() => setShowMigrate(false)}>{t('cancel')}</Button>
            <Button variant="primary" disabled={migrating} onClick={runMigrate}>
              {migrating ? t('loading') : t('bankTreeMigrateRun')}
            </Button>
          </>
        }
      >
        <p className="nx-text-base nx-text-muted">{t('bankTreeMigrateBody', String(activeFlat.length), String(groupedForMigrate.length))}</p>
        <div className="nx-overflow-auto nx-grid nx-gap-8 nx-mt-12 nx-rounded" style={{ maxHeight: 200 }}>
          {groupedForMigrate.map((g, i) => (
            <div key={i} className="nx-p-8 nx-rounded nx-bg-muted nx-text-sm">
              <strong>{g.categoryName}</strong> — {g.keywords.slice(0, 6).join(', ')}
              {g.keywords.length > 6 ? '…' : ''}
            </div>
          ))}
        </div>
      </AdaptiveSheet>

      <AdaptiveSheet
        open={showImportModal}
        onClose={() => !importBusy && setShowImportModal(false)}
        title={t('bankRulesImport')}
        size="md"
        side="start"
        className="bank-rules-import-drawer"
        closeOnBackdrop={!importBusy}
        footer={
          <>
            <Button variant="ghost" disabled={importBusy} onClick={() => setShowImportModal(false)}>{t('cancel')}</Button>
            <Button variant="primary" disabled={importBusy} onClick={runPackImport}>
              {importBusy ? t('loading') : t('bankRulesImportRun')}
            </Button>
          </>
        }
      >
        <div className="nx-grid nx-gap-12 nx-mt-12">
          {otherCompanies.length > 0 ? (
            <label className="nx-checkbox">
              <input type="radio" name="impSrc" checked={importSource === 'company'} onChange={() => setImportSource('company')} />
              {t('bankRulesImportSourceCompany')}
            </label>
          ) : (
            <p className="nx-text-sm nx-text-muted nx-m-0">{t('bankRulesNoOtherCompanies')}</p>
          )}
          <label className="nx-checkbox">
            <input type="radio" name="impSrc" checked={importSource === 'file'} onChange={() => setImportSource('file')} />
            {t('bankRulesImportSourceFile')}
          </label>
          {importSource === 'company' && otherCompanies.length > 0 ? (
            <Input
              type="select"
              value={importSourceCompanyId}
              onChange={(e) => setImportSourceCompanyId(e.target.value)}
            >
              <option value="">{t('bankRulesSelectCompany')}</option>
              {otherCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameAr || c.nameEn || c.name || c.id}
                </option>
              ))}
            </Input>
          ) : null}
          {importSource === 'file' ? (
            <div>
              <label className="nx-file-label" style={{ display: 'inline-flex', maxWidth: '100%' }}>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                {importFile ? importFile.name : (t('bankRulesChooseFile') || 'اختر ملف JSON')}
              </label>
            </div>
          ) : null}
          <div className="nx-grid nx-gap-8 nx-border-t" style={{ paddingTop: 10 }}>
            <label className="nx-checkbox">
              <input type="radio" name="impMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
              {t('bankRulesImportModeMerge')}
            </label>
            <label className="nx-checkbox">
              <input type="radio" name="impMode" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
              {t('bankRulesImportModeReplace')}
            </label>
          </div>
        </div>
      </AdaptiveSheet>
    </div>
  );
}
