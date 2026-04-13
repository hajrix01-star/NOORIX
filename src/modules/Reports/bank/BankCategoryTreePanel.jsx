/**
 * مطابق CategoryTreeManager.jsx + CategoryCard + CategoryFormDialog في Base44
 * + تصدير/استيراد حزمة القواعد (فئات شجرية + قواعد مسطّحة) من ملف أو من شركة أخرى.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useToast } from '../../../context/ToastContext';
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
  throwIfApiFailed,
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

function CategoryFormModal({ open, onClose, category, existingCategories, companyId, t }) {
  const { showToast } = useToast();
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

  const createMut = useApiMutation({
    mutationFn: (body) => bankStatementTreeCategoryCreate(body),
    invalidateQueries: [['bank-tree-categories', companyId]],
    successToast: () => t('savedSuccessfully'),
    errorToast: (e) => e?.message || t('apiRequestFailed'),
    onSuccess: () => onClose(),
  });

  const updateMut = useApiMutation({
    mutationFn: ({ id, patch }) => bankStatementTreeCategoryUpdate(companyId, id, patch),
    invalidateQueries: [['bank-tree-categories', companyId]],
    successToast: () => t('savedSuccessfully'),
    errorToast: (e) => e?.message || t('apiRequestFailed'),
    onSuccess: () => onClose(),
  });

  const handleSave = () => {
    if (!name.trim()) {
      showToast(t('bankTreeCategoryNameRequired'), 'error');
      return;
    }
    const cleanClassifications = classifications
      .filter((c) => c.name?.trim() || (c.keywords && c.keywords.length))
      .map((c) => ({
        name: (c.name || '').trim() || t('bankTreeUnnamedClassification'),
        keywords: (c.keywords || []).filter(Boolean),
      }));
    if (!cleanClassifications.length || cleanClassifications.every((c) => !c.keywords.length)) {
      showToast(t('bankTreeClassificationKeywordsRequired'), 'error');
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
      showToast(t('bankTreeDuplicateKeyword'), 'error');
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
      <div className="grid gap-3.5">
        <div className="grid gap-2.5 grid-cols-[1fr_100px]">
          <Input type="text" label={`${t('bankTreeCategoryName')} *`} value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" label={t('bankTreeSortOrder')} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} min={1} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
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

        <div className="p-3 rounded-[10px] border border-[var(--noorix-amber-35)] bg-[rgba(254,243,199,0.35)]">
          <div className="text-[13px] font-semibold mb-1.5">{t('bankTreeParentKeywords')}</div>
          <p className="text-[11px] text-noorix-muted mb-2">{t('bankTreeParentKeywordsHint')}</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {parentKeywords.map((kw, idx) => (
              <span key={idx} className="text-[11px] px-2 py-[2px] rounded-[6px] bg-noorix-surface border border-noorix-border">
                {kw}
                <Button variant="ghost" size="sm" onClick={() => setParentKeywords((p) => p.filter((_, i) => i !== idx))} className="ms-1.5 text-noorix-red px-1" style={{ minHeight: 'auto' }}>
                  ×
                </Button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0">
              <Input type="text" value={newParentKeyword} onChange={(e) => setNewParentKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParentKw())} placeholder="…" />
            </div>
            <Button onClick={addParentKw}>+</Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">{t('bankTreeSubClassifications')}</span>
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
                border: activeClassIdx === idx ? '2px solid var(--noorix-blue-45)' : '1px solid var(--noorix-border)',
                background: activeClassIdx === idx ? 'var(--noorix-blue-6)' : 'var(--noorix-bg-muted)',
              }}
            >
              <div className="flex gap-2 mb-2">
                <div className="flex-1 min-w-0">
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
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(cl.keywords || []).map((kw, kwIdx) => (
                  <span key={kwIdx} className="text-[11px] font-mono px-2 py-[2px] rounded-[6px] bg-noorix-surface border border-noorix-border">
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
                      className="ms-1 px-1" style={{ minHeight: 'auto' }}
                    >
                      ×
                    </Button>
                  </span>
                ))}
              </div>
              {activeClassIdx === idx ? (
                <div className="flex gap-1.5">
                  <div className="flex-1 min-w-0">
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
    <div className="noorix-surface-card p-3.5" style={{ opacity: active ? 1 : 0.55 }}>
        <div className="flex gap-3 flex-wrap justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex flex-wrap gap-2 mb-2">
            {index != null ? (
              <span
                className="text-[11px] font-extrabold w-[26px] h-[26px] rounded-full inline-flex items-center justify-center"
                style={{
                  color: 'white',
                  background: 'linear-gradient(135deg,var(--noorix-navy-light),var(--noorix-navy))',
                }}
              >
                {index}
              </span>
            ) : null}
            <span className="font-bold">{category.name}</span>
            <span className="text-[11px] py-[2px] px-2 rounded-md" style={{ background: typeInfo.color, color: typeInfo.colorText }}>
              {typeInfo.icon} {typeInfo.label}
            </span>
            {category.transactionSide && category.transactionSide !== 'any' ? (
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--noorix-border)',
                  background: category.transactionSide === 'debit' ? 'var(--noorix-red-8)' : 'var(--noorix-green-8)',
                }}
              >
                {sideInfo.icon} {t(sideInfo.labelKey)}
              </span>
            ) : null}
            <span className="text-[10px] px-2 py-[2px] rounded-[6px] bg-noorix-bg-muted">
              {classifications.length} {t('bankTreeStatsClassifications')} · {totalKw} {t('bankTreeStatsKeywords')}
            </span>
          </div>
          {parentKeywords.length > 0 ? (
            <div className="text-[11px] mb-2 text-noorix-amber">
              {t('bankTreeParentKeywordsShort')}: {parentKeywords.join(' · ')}
            </div>
          ) : null}
          {classifications.length > 0 ? (
            <div className="grid gap-1.5">
              {classifications.map((cl, idx) => (
                <div key={idx} className="text-[12px] pl-2 border-l-2 border-noorix-border">
                  <strong>{cl.name}</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(cl.keywords || []).map((kw, ki) => (
                      <code key={ki} className="text-[10px] px-1.5 py-[2px] rounded bg-noorix-bg-muted">
                        {kw}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0 items-end">
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

export default function BankCategoryTreePanel({ companyId, companies = [] }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
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
      throwIfApiFailed(res, res.error || 'فشل التحميل');
      return res.data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: flatRules = [] } = useQuery({
    queryKey: ['bank-classification-rules', companyId],
    queryFn: async () => {
      const res = await bankStatementClassificationRulesList(companyId);
      throwIfApiFailed(res, res.error || 'فشل التحميل');
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

  const deleteMut = useApiMutation({
    mutationFn: (id) => bankStatementTreeCategoryDelete(companyId, id),
    invalidateQueries: [qKey],
    successToast: () => t('deletedSuccessfully'),
    errorToast: (e) => e?.message || t('apiRequestFailed'),
  });

  const updateMut = useApiMutation({
    mutationFn: ({ id, patch }) => bankStatementTreeCategoryUpdate(companyId, id, patch),
    invalidateQueries: [qKey],
    showErrorToast: true,
    errorToast: (e) => e?.message || t('apiRequestFailed'),
  });

  const seedDefaultsMut = useApiMutation({
    mutationFn: () => bankStatementTreeCategoriesSeedDefaults(companyId),
    invalidateQueries: [qKey],
    successToast: (res) => {
      const inner = res?.data ?? res;
      const n = inner?.created ?? 8;
      return t('bankTreeSeedDefaultsDone', String(n));
    },
    errorToast: (e) => e?.message || t('bankTreeSeedDefaultsError'),
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
        throwIfApiFailed(res, res.error || 'migrate');
        order += 10;
      }
      await qc.invalidateQueries({ queryKey: qKey });
      await qc.invalidateQueries({ queryKey: ['bank-classification-rules', companyId] });
      showToast(t('bankTreeMigrateDone', String(groupedForMigrate.length)));
      setShowMigrate(false);
    } catch (e) {
      showToast(e?.message || 'Error', 'error');
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
      throwIfApiFailed(res, res.error || 'export');
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
      showToast(t('bankRulesExportDone'));
    } catch (e) {
      showToast(e?.message || 'Error', 'error');
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
          showToast(t('bankRulesSelectCompany'), 'error');
          return;
        }
        res = await bankStatementClassificationRulesImportFromCompany(companyId, importSourceCompanyId, importMode);
      } else {
        if (!importFile) {
          showToast(t('bankRulesPickFile'), 'error');
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
      throwIfApiFailed(res, res.error || 'import');
      const d = res.data ?? res;
      showToast(
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
      showToast(e?.message || 'Error', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <div className="noorix-surface-card flex items-center flex flex-wrap gap-3 p-3 mb-3">
        <span className="text-[13px] text-noorix-muted">{t('bankTreeStatsCategories')}</span>
        <strong>{sortedCategories.length}</strong>
        <span className="text-noorix-border">|</span>
        <span className="text-[13px] text-noorix-muted">{t('bankTreeStatsClassifications')}</span>
        <strong className="text-noorix-blue">{totalClassifications}</strong>
        <span className="text-noorix-border">|</span>
        <span className="text-[13px] text-noorix-muted">{t('bankTreeStatsKeywords')}</span>
        <strong className="text-noorix-green">{totalKeywords}</strong>
        {inactiveCategories.length > 0 ? (
          <span className="text-[11px] text-noorix-muted">
            ({t('bankTreeInactiveCount', String(inactiveCategories.length))})
          </span>
        ) : null}
      </div>

      <div className="nx-toolbar mb-4">
        <Button size="sm" variant="primary" onClick={openNew}>+ {t('bankTreeAddCategory')}</Button>
        {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
          <Button size="sm" disabled={seedDefaultsMut.isPending} onClick={() => seedDefaultsMut.mutate()}>
            {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
          </Button>
        ) : null}
        {activeFlat.length > 0 && categories.length === 0 ? (
          <Button size="sm" onClick={() => setShowMigrate(true)}>{t('bankTreeMigrateOldRules', String(activeFlat.length))}</Button>
        ) : null}
        <Button size="sm" disabled={exportBusy} onClick={handleExportRules}>{exportBusy ? '…' : t('bankRulesExport')}</Button>
        <Button size="sm" onClick={openImportModal}>{t('bankRulesImport')}</Button>
      </div>

      {isLoading ? <p className="text-noorix-muted">{t('loading')}…</p> : null}

      {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
        <div className="noorix-surface-card text-center text-noorix-muted p-6">
          <div className="mb-3 text-[20px]"></div>
          <div className="font-semibold mb-1.5">{t('bankTreeEmptyTitle')}</div>
          <div className="text-[13px] mb-2">{t('bankTreeEmptyDesc')}</div>
          <p className="text-[12px] text-noorix-muted mb-4 max-w-[420px] mx-auto">
            {t('bankTreeSeedDefaultsHint')}
          </p>
          <div className="flex flex-wrap gap-2.5 text-center justify-center">
            <Button size="sm" variant="primary" onClick={openNew}>{t('bankTreeCreateFirst')}</Button>
            <Button size="sm" disabled={seedDefaultsMut.isPending} onClick={() => seedDefaultsMut.mutate()}>
              {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2.5">
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
        <div className="mt-5">
          <h4 className="text-[13px] text-noorix-muted">{t('bankTreeInactiveSection', String(inactiveCategories.length))}</h4>
          <div className="grid gap-2.5 mt-2.5">
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
        <p className="text-[13px] text-noorix-muted">{t('bankTreeMigrateBody', String(activeFlat.length), String(groupedForMigrate.length))}</p>
        <div className="overflow-auto grid gap-2 mt-3 rounded-lg max-h-[200px]">
          {groupedForMigrate.map((g, i) => (
            <div key={i} className="p-2 rounded-lg bg-noorix-bg-muted text-[12px]">
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
        <div className="grid gap-3 mt-3">
          {otherCompanies.length > 0 ? (
            <label className="nx-checkbox">
              <input type="radio" name="impSrc" checked={importSource === 'company'} onChange={() => setImportSource('company')} />
              {t('bankRulesImportSourceCompany')}
            </label>
          ) : (
            <p className="text-[12px] text-noorix-muted m-0">{t('bankRulesNoOtherCompanies')}</p>
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
              <label className="nx-file-label inline-flex max-w-full">
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                {importFile ? importFile.name : (t('bankRulesChooseFile') || 'اختر ملف JSON')}
              </label>
            </div>
          ) : null}
          <div className="grid gap-2 border-t border-noorix-border pt-2.5">
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
