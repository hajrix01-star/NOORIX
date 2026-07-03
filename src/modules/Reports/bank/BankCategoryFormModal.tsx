/**
 * نموذج إنشاء/تعديل فئة شجرية — نفس السلوك السابق.
 */
import React, { useState, useEffect } from 'react';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useToast } from '../../../context/ToastContext';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import {
  bankStatementTreeCategoryCreate,
  bankStatementTreeCategoryUpdate,
} from '../../../services/api';
import { TRANSACTION_TYPES, TRANSACTION_SIDES } from './bankRuleConstants';
import { bankKeys } from '../../../services/queryKeys';
import { normParentKeywords, normClassifications } from './utils/bankCategoryTreeNormalize';

type ClassificationDraft = { name: string; keywords: string[] };

export type BankCategoryFormModalProps = {
  open: boolean;
  onClose: () => void;
  category: Record<string, unknown> | null;
  existingCategories: unknown[];
  companyId: string;
  t: (k: string, ...args: string[]) => string;
};

export function BankCategoryFormModal({
  open,
  onClose,
  category,
  existingCategories,
  companyId,
  t,
}: BankCategoryFormModalProps) {
  const { showToast } = useToast();
  const EMPTY: ClassificationDraft = { name: '', keywords: [] };
  const [name, setName] = useState('');
  const [parentKeywords, setParentKeywords] = useState<string[]>([]);
  const [newParentKeyword, setNewParentKeyword] = useState('');
  const [transactionType, setTransactionType] = useState('expense');
  const [transactionSide, setTransactionSide] = useState('any');
  const [sortOrder, setSortOrder] = useState<number | string>(100);
  const [classifications, setClassifications] = useState<ClassificationDraft[]>([{ ...EMPTY }]);
  const [newKeyword, setNewKeyword] = useState('');
  const [activeClassIdx, setActiveClassIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(String(category.name || ''));
      setParentKeywords(normParentKeywords(category.parentKeywords));
      setTransactionType(String(category.transactionType || 'expense'));
      setTransactionSide(String(category.transactionSide || 'any'));
      setSortOrder(Number(category.sortOrder ?? 100));
      const cls = normClassifications(category.classifications);
      setClassifications(cls.length ? cls : [{ ...EMPTY }]);
    } else {
      const maxOrder = (existingCategories || []).reduce(
        (m: number, c: unknown) =>
          Math.max(m, Number((c as { sortOrder?: number }).sortOrder ?? 0)),
        0,
      );
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
    mutationFn: (body: unknown) => bankStatementTreeCategoryCreate(body as Parameters<typeof bankStatementTreeCategoryCreate>[0]),
    invalidateQueries: [bankKeys.treeCategories(companyId)],
    successToast: () => t('savedSuccessfully'),
    errorToast: (e: Error) => e?.message || t('apiRequestFailed'),
    onSuccess: () => onClose(),
  });

  const updateMut = useApiMutation({
    mutationFn: ({ id, patch }: { id: string; patch: unknown }) =>
      bankStatementTreeCategoryUpdate(companyId, id, patch as never),
    invalidateQueries: [bankKeys.treeCategories(companyId)],
    successToast: () => t('savedSuccessfully'),
    errorToast: (e: Error) => e?.message || t('apiRequestFailed'),
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
    const cid = category?.id as string | undefined;
    if (cid) {
      updateMut.mutate({ id: cid, patch: payload });
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

  const addKw = (classIdx: number) => {
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
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={pending}>
            {pending ? t('loading') : t('save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <div className="grid gap-2.5 grid-cols-[1fr_100px]">
          <Input
            type="text"
            label={`${t('bankTreeCategoryName')} *`}
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
          <Input
            type="number"
            label={t('bankTreeSortOrder')}
            value={sortOrder}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSortOrder(e.target.value)}
            min={1}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            type="select"
            label={t('bankTreeTransactionType')}
            value={transactionType}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTransactionType(e.target.value)}
          >
            {TRANSACTION_TYPES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.icon} {t(x.labelKey)}
              </option>
            ))}
          </Input>
          <Input
            type="select"
            label={t('bankTreeTransactionSide')}
            value={transactionSide}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTransactionSide(e.target.value)}
          >
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
              <span
                key={idx}
                className="text-[11px] px-2 py-[2px] rounded-[6px] bg-noorix-surface border border-noorix-border"
              >
                {kw}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setParentKeywords((p) => p.filter((_, i) => i !== idx))}
                  className="ms-1.5 text-noorix-red px-1 min-h-[auto]"
                >
                  ×
                </Button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0">
              <Input
                type="text"
                value={newParentKeyword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewParentKeyword(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                  e.key === 'Enter' && (e.preventDefault(), addParentKw())
                }
                placeholder="…"
              />
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
              role="presentation"
              onClick={() => setActiveClassIdx(idx)}
              className={`mb-2 rounded-[10px] p-3 ${
                activeClassIdx === idx
                  ? 'border-2 border-[var(--noorix-blue-45)] bg-[var(--noorix-blue-6)]'
                  : 'border border-noorix-border bg-noorix-bg-muted'
              }`}
            >
              <div className="flex gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <Input
                    type="text"
                    value={cl.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setClassifications((p) =>
                        p.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c)),
                      )
                    }
                    placeholder={t('bankTreeSubNamePlaceholder')}
                  />
                </div>
                {classifications.length > 1 ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
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
                  <span
                    key={kwIdx}
                    className="text-[11px] font-mono px-2 py-[2px] rounded-[6px] bg-noorix-surface border border-noorix-border"
                  >
                    {kw}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setClassifications((p) =>
                          p.map((c, i) =>
                            i === idx ? { ...c, keywords: c.keywords.filter((_, ki) => ki !== kwIdx) } : c,
                          ),
                        );
                      }}
                      className="ms-1 px-1 min-h-[auto]"
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKeyword(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                        e.key === 'Enter' && (e.preventDefault(), addKw(idx))
                      }
                      placeholder={t('bankTreeAddKeywordPlaceholder')}
                    />
                  </div>
                  <Button variant="primary" onClick={() => addKw(idx)} disabled={!newKeyword.trim()}>
                    +
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </AdaptiveSheet>
  );
}
