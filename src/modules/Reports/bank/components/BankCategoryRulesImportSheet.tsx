import React from 'react';
import { AdaptiveSheet, DialogActions, FileTrigger, Input, Radio } from '../../../../ui';
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
        <DialogActions
          actions={[
            {
              key: 'cancel',
              label: t('cancel'),
              role: 'cancel',
              disabled: importBusy,
              onClick: onClose,
            },
            {
              key: 'run-import',
              label: importBusy ? t('loading') : t('bankRulesImportRun'),
              role: 'primary',
              disabled: importBusy,
              onClick: onRunImport,
            },
          ]}
        />
      }
    >
      <div className="grid gap-3 mt-3">
        {otherCompanies.length > 0 ? (
          <Radio
            name="impSrc"
            checked={importSource === 'company'}
            onChange={() => setImportSource('company')}
            label={t('bankRulesImportSourceCompany')}
          />
        ) : (
          <p className="text-[12px] text-noorix-muted m-0">{t('bankRulesNoOtherCompanies')}</p>
        )}
        <Radio
          name="impSrc"
          checked={importSource === 'file'}
          onChange={() => setImportSource('file')}
          label={t('bankRulesImportSourceFile')}
        />
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
            <FileTrigger
              accept="application/json,.json"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setImportFile(e.target.files?.[0] || null)
              }
              label={importFile ? importFile.name : t('bankRulesChooseFile') || 'اختر ملف JSON'}
              buttonProps={{ variant: 'secondary', size: 'sm', className: 'max-w-full justify-start' }}
            />
          </div>
        ) : null}
        <div className="grid gap-2 border-t border-noorix-border pt-2.5">
          <Radio
            name="impMode"
            checked={importMode === 'merge'}
            onChange={() => setImportMode('merge')}
            label={t('bankRulesImportModeMerge')}
          />
          <Radio
            name="impMode"
            checked={importMode === 'replace'}
            onChange={() => setImportMode('replace')}
            label={t('bankRulesImportModeReplace')}
          />
        </div>
      </div>
    </AdaptiveSheet>
  );
}
