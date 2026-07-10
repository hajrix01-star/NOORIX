import React from 'react';
import { Button } from '../../../../ui';
import { BankCategoryCardRow } from '../BankCategoryCardRow';
import type { BankClassificationRule, BankTreeCategory, BankTreeCategoryPatch } from '../bankCategoryTree.types';

type MutFn<T> = { isPending: boolean; mutate: (variables: T) => void };

export function BankCategoryTreePanelContent({
  t,
  isLoading,
  sortedCategories,
  inactiveCategories,
  totalKeywords,
  totalClassifications,
  openNew,
  seedDefaultsMut,
  activeFlat,
  categories,
  setShowMigrate,
  handleExportRules,
  exportBusy,
  openImportModal,
  deleteMut,
  updateMut,
  openEdit,
}: {
  t: (k: string, ...args: string[]) => string;
  isLoading: boolean;
  sortedCategories: BankTreeCategory[];
  inactiveCategories: BankTreeCategory[];
  totalKeywords: number;
  totalClassifications: number;
  openNew: () => void;
  seedDefaultsMut: MutFn<undefined>;
  activeFlat: BankClassificationRule[];
  categories: BankTreeCategory[];
  setShowMigrate: (v: boolean) => void;
  handleExportRules: () => void;
  exportBusy: boolean;
  openImportModal: () => void;
  deleteMut: MutFn<string>;
  updateMut: MutFn<{ id: string; patch: BankTreeCategoryPatch }>;
  openEdit: (cat: BankTreeCategory) => void;
}) {
  return (
    <>
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
        <Button size="sm" variant="primary" onClick={openNew}>
          + {t('bankTreeAddCategory')}
        </Button>
        {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
          <Button size="sm" disabled={seedDefaultsMut.isPending} onClick={() => seedDefaultsMut.mutate(undefined)}>
            {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
          </Button>
        ) : null}
        {activeFlat.length > 0 && categories.length === 0 ? (
          <Button size="sm" onClick={() => setShowMigrate(true)}>
            {t('bankTreeMigrateOldRules', String(activeFlat.length))}
          </Button>
        ) : null}
        <Button size="sm" disabled={exportBusy} onClick={handleExportRules}>
          {exportBusy ? '…' : t('bankRulesExport')}
        </Button>
        <Button size="sm" onClick={openImportModal}>
          {t('bankRulesImport')}
        </Button>
      </div>

      {isLoading ? <p className="text-noorix-muted">{t('loading')}…</p> : null}

      {!isLoading && sortedCategories.length === 0 && inactiveCategories.length === 0 ? (
        <div className="noorix-surface-card text-center text-noorix-muted p-6">
          <div className="mb-3 text-[20px]" />
          <div className="font-semibold mb-1.5">{t('bankTreeEmptyTitle')}</div>
          <div className="text-[13px] mb-2">{t('bankTreeEmptyDesc')}</div>
          <p className="text-[12px] text-noorix-muted mb-4 max-w-[420px] mx-auto">{t('bankTreeSeedDefaultsHint')}</p>
          <div className="flex flex-wrap gap-2.5 text-center justify-center">
            <Button size="sm" variant="primary" onClick={openNew}>
              {t('bankTreeCreateFirst')}
            </Button>
            <Button size="sm" disabled={seedDefaultsMut.isPending} onClick={() => seedDefaultsMut.mutate(undefined)}>
              {seedDefaultsMut.isPending ? '…' : t('bankTreeSeedDefaults')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2.5">
        {sortedCategories.map((cat, idx) => (
          <BankCategoryCardRow
            key={String(cat.id)}
            category={cat}
            index={idx + 1}
            t={t}
            onEdit={() => openEdit(cat)}
            onDelete={() => {
              if (window.confirm(t('bankTreeDeleteConfirm'))) deleteMut.mutate(String(cat.id));
            }}
            onToggle={() =>
              updateMut.mutate({
                id: String(cat.id),
                patch: { isActive: !cat.isActive },
              })
            }
          />
        ))}
      </div>

      {inactiveCategories.length > 0 ? (
        <div className="mt-5">
          <h4 className="text-[13px] text-noorix-muted">
            {t('bankTreeInactiveSection', String(inactiveCategories.length))}
          </h4>
          <div className="grid gap-2.5 mt-2.5">
            {inactiveCategories.map((cat) => (
              <BankCategoryCardRow
                key={String(cat.id)}
                category={cat}
                t={t}
                onEdit={() => openEdit(cat)}
                onDelete={() => {
                  if (window.confirm(t('bankTreeDeleteConfirm'))) deleteMut.mutate(String(cat.id));
                }}
                onToggle={() => updateMut.mutate({ id: String(cat.id), patch: { isActive: true } })}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
