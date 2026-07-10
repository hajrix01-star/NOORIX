/**
 * شجرة التصنيف + استيراد/تصدير القواعد — نفس السلوك السابق.
 */
import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  bankStatementTreeCategoryCreate,
  bankStatementTreeCategoryDelete,
  bankStatementTreeCategoryUpdate,
  bankStatementTreeCategoriesSeedDefaults,
  bankStatementClassificationRulesExportPack,
  bankStatementClassificationRulesImportPack,
  bankStatementClassificationRulesImportFromCompany,
  throwIfApiFailed,
} from '../../../services/api';
import { getSaudiToday } from '../../../utils/saudiDate';
import { bankKeys } from '../../../services/queryKeys';
import { BankCategoryFormModal } from './BankCategoryFormModal';
import { BankCategoryMigrateSheet } from './components/BankCategoryMigrateSheet';
import { BankCategoryRulesImportSheet } from './components/BankCategoryRulesImportSheet';
import { BankCategoryTreePanelContent } from './components/BankCategoryTreePanelContent';
import {
  useBankCategoryTreeData,
  type CompanyOption,
} from './hooks/useBankCategoryTreeData';
import type { BankTreeCategory, BankTreeCategoryPatch } from './bankCategoryTree.types';

export type BankCategoryTreePanelProps = {
  companyId?: string;
  companies?: CompanyOption[];
};

export default function BankCategoryTreePanel({
  companyId,
  companies = [],
}: BankCategoryTreePanelProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BankTreeCategory | null>(null);
  const [showMigrate, setShowMigrate] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSource, setImportSource] = useState('company');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importSourceCompanyId, setImportSourceCompanyId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const data = useBankCategoryTreeData(companyId, companies, t);

  const deleteMut = useApiMutation({
    mutationFn: (id: string) => bankStatementTreeCategoryDelete(companyId || '', id),
    invalidateQueries: [data.treeKey],
    successToast: () => t('deletedSuccessfully'),
    errorToast: (e: { message?: string }) => e?.message || t('apiRequestFailed'),
  });

  const updateMut = useApiMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BankTreeCategoryPatch }) =>
      bankStatementTreeCategoryUpdate(companyId || '', id, patch),
    invalidateQueries: [data.treeKey],
    showErrorToast: true,
    errorToast: (e: { message?: string }) => e?.message || t('apiRequestFailed'),
  });

  const seedDefaultsMut = useApiMutation({
    mutationFn: () => bankStatementTreeCategoriesSeedDefaults(companyId || ''),
    invalidateQueries: [data.treeKey],
    successToast: (res: unknown) => {
      const inner = (res as { data?: { created?: number } })?.data ?? res;
      const n = (inner as { created?: number })?.created ?? 8;
      return t('bankTreeSeedDefaultsDone', String(n));
    },
    errorToast: (e: { message?: string }) => e?.message || t('bankTreeSeedDefaultsError'),
  });

  const runMigrate = async () => {
    if (!companyId) {
      showToast(t('selectCompanyFirst'), 'error');
      return;
    }
    setMigrating(true);
    try {
      let order = 10;
      for (const group of data.groupedForMigrate) {
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
      await qc.invalidateQueries({ queryKey: data.treeKey });
      await qc.invalidateQueries({ queryKey: bankKeys.classificationRules(companyId || '') });
      showToast(t('bankTreeMigrateDone', String(data.groupedForMigrate.length)));
      setShowMigrate(false);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setMigrating(false);
    }
  };

  const openNew = useCallback(() => {
    setEditing(null);
    setShowForm(true);
  }, []);

  const openEdit = useCallback((cat: BankTreeCategory) => {
    setEditing(cat);
    setShowForm(true);
  }, []);

  const invalidateRulesQueries = useCallback(() => {
    qc.invalidateQueries({ queryKey: bankKeys.treeCategories(companyId || '') });
    qc.invalidateQueries({ queryKey: bankKeys.classificationRules(companyId || '') });
  }, [qc, companyId]);

  const handleExportRules = async () => {
    setExportBusy(true);
    try {
      const res = await bankStatementClassificationRulesExportPack(companyId || '');
      throwIfApiFailed(res, res.error || 'export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noorix-bank-rules-${String(companyId).slice(-8)}-${getSaudiToday()}.json`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t('bankRulesExportDone'));
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const openImportModal = () => {
    const hasOthers = data.otherCompanies.length > 0;
    setImportSource(hasOthers ? 'company' : 'file');
    setImportMode('merge');
    setImportFile(null);
    setImportSourceCompanyId(data.otherCompanies[0]?.id || '');
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
        res = await bankStatementClassificationRulesImportFromCompany(
          companyId || '',
          importSourceCompanyId,
          importMode,
        );
      } else {
        if (!importFile) {
          showToast(t('bankRulesPickFile'), 'error');
          return;
        }
        const text = await importFile.text();
        let pack: unknown;
        try {
          pack = JSON.parse(text);
        } catch {
          throw new Error(t('bankRulesInvalidFile'));
        }
        res = await bankStatementClassificationRulesImportPack(companyId || '', pack, importMode);
      }
      throwIfApiFailed(res, res.error || 'import');
      type RulesImportStats = {
        treeCreated?: number;
        treeSkipped?: number;
        rulesCreated?: number;
        rulesSkipped?: number;
      };
      const d = ((res as { data?: RulesImportStats }).data ?? res) as RulesImportStats;
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
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  if (!companyId) return null;

  const {
    sortedCategories,
    inactiveCategories,
    isLoading,
    categories,
    activeFlat,
    totalKeywords,
    totalClassifications,
    groupedForMigrate,
    otherCompanies,
  } = data;

  return (
    <div className="p-4 max-w-[800px] mx-auto">
      <BankCategoryTreePanelContent
        t={t}
        isLoading={isLoading}
        sortedCategories={sortedCategories}
        inactiveCategories={inactiveCategories}
        totalKeywords={totalKeywords}
        totalClassifications={totalClassifications}
        openNew={openNew}
        seedDefaultsMut={seedDefaultsMut}
        activeFlat={activeFlat}
        categories={categories}
        setShowMigrate={setShowMigrate}
        handleExportRules={handleExportRules}
        exportBusy={exportBusy}
        openImportModal={openImportModal}
        deleteMut={deleteMut}
        updateMut={updateMut}
        openEdit={openEdit}
      />

      <BankCategoryFormModal
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

      <BankCategoryMigrateSheet
        open={showMigrate}
        migrating={migrating}
        onClose={() => setShowMigrate(false)}
        onRun={runMigrate}
        activeFlatCount={activeFlat.length}
        groupedForMigrate={groupedForMigrate}
        t={t}
      />

      <BankCategoryRulesImportSheet
        open={showImportModal}
        importBusy={importBusy}
        onClose={() => setShowImportModal(false)}
        onRunImport={runPackImport}
        importSource={importSource}
        setImportSource={setImportSource}
        importMode={importMode}
        setImportMode={setImportMode}
        importSourceCompanyId={importSourceCompanyId}
        setImportSourceCompanyId={setImportSourceCompanyId}
        importFile={importFile}
        setImportFile={setImportFile}
        otherCompanies={otherCompanies}
        t={t}
      />
    </div>
  );
}
