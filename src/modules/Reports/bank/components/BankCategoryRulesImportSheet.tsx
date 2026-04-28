import React from 'react';
import { Button, Input, AdaptiveSheet } from '../../../../ui';
import type { CompanyOption } from '../hooks/useBankCategoryTreeData';

export function BankCategoryRulesImportSheet({
  open,
  importBusy,
  onClose,
  onRunImport,
  importSource,
  setImportSource,
  importMode,
  setImportMode,
  importSourceCompanyId,
  setImportSourceCompanyId,
  importFile,
  setImportFile,
  otherCompanies,
  t,
}: {
  open: boolean;
  importBusy: boolean;
  onClose: () => void;
  onRunImport: () => void;
  importSource: string;
  setImportSource: (v: string) => void;
  importMode: 'merge' | 'replace';
  setImportMode: (v: 'merge' | 'replace') => void;
  importSourceCompanyId: string;
  setImportSourceCompanyId: (v: string) => void;
  importFile: File | null;
  setImportFile: (f: File | null) => void;
  otherCompanies: CompanyOption[];
  t: (k: string, ...args: string[]) => string;
}) {
  return (
    <AdaptiveSheet
      open={open}
      onClose={() => !importBusy && onClose()}
      title={t('bankRulesImport')}
      size="md"
      side="start"
      className="bank-rules-import-drawer"
      closeOnBackdrop={!importBusy}
      footer={
        <>
          <Button variant="ghost" disabled={importBusy} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" disabled={importBusy} onClick={onRunImport}>
            {importBusy ? t('loading') : t('bankRulesImportRun')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 mt-3">
        {otherCompanies.length > 0 ? (
          <label className="nx-checkbox">
            <input
              type="radio"
              name="impSrc"
              checked={importSource === 'company'}
              onChange={() => setImportSource('company')}
            />
            {t('bankRulesImportSourceCompany')}
          </label>
        ) : (
          <p className="text-[12px] text-noorix-muted m-0">{t('bankRulesNoOtherCompanies')}</p>
        )}
        <label className="nx-checkbox">
          <input
            type="radio"
            name="impSrc"
            checked={importSource === 'file'}
            onChange={() => setImportSource('file')}
          />
          {t('bankRulesImportSourceFile')}
        </label>
        {importSource === 'company' && otherCompanies.length > 0 ? (
          <Input
            type="select"
            value={importSourceCompanyId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setImportSourceCompanyId(e.target.value)
            }
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setImportFile(e.target.files?.[0] || null)
                }
              />
              {importFile ? importFile.name : t('bankRulesChooseFile') || 'اختر ملف JSON'}
            </label>
          </div>
        ) : null}
        <div className="grid gap-2 border-t border-noorix-border pt-2.5">
          <label className="nx-checkbox">
            <input
              type="radio"
              name="impMode"
              checked={importMode === 'merge'}
              onChange={() => setImportMode('merge')}
            />
            {t('bankRulesImportModeMerge')}
          </label>
          <label className="nx-checkbox">
            <input
              type="radio"
              name="impMode"
              checked={importMode === 'replace'}
              onChange={() => setImportMode('replace')}
            />
            {t('bankRulesImportModeReplace')}
          </label>
        </div>
      </div>
    </AdaptiveSheet>
  );
}
