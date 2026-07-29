import { type ChangeEvent } from 'react';
import { Button, Checkbox, Input, AdaptiveSheet } from '../../../../ui';
import type {
  BackupImportModal,
  BackupImportVariables,
  SettingsMutationLike,
  TranslationFn,
} from '../../settingsTypes';

type BackupImportCompanySheetProps = {
  t: TranslationFn;
  importModal: BackupImportModal | null;
  setImportModal: (value: BackupImportModal | null) => void;
  importMut: SettingsMutationLike<BackupImportVariables>;
  importNameAr: string;
  setImportNameAr: (value: string) => void;
  importConfirmed: boolean;
  setImportConfirmed: (value: boolean) => void;
  importStrictAlloc: boolean;
  setImportStrictAlloc: (value: boolean) => void;
};

export function BackupImportCompanySheet({
  t,
  importModal,
  setImportModal,
  importMut,
  importNameAr,
  setImportNameAr,
  importConfirmed,
  setImportConfirmed,
  importStrictAlloc,
  setImportStrictAlloc,
}: BackupImportCompanySheetProps) {
  const closeSheet = () => {
    if (importMut.isPending) return;
    setImportModal(null);
    setImportConfirmed(false);
    setImportStrictAlloc(false);
  };

  return (
    <AdaptiveSheet
      open={!!importModal}
      onClose={closeSheet}
      title={t('backupImportNewCompany')}
      size="md"
      side="start"
      className="backup-import-drawer"
    >
      <div
        className="text-[13px] font-medium py-[10px] px-[14px] mb-[14px] rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
        role="alert"
      >
        {t('backupImportWarn')}
      </div>

      <Input
        type="text"
        label={t('backupImportNameLabel')}
        value={importNameAr}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setImportNameAr(event.target.value)}
      />

      <Checkbox
        checked={importConfirmed}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setImportConfirmed(event.target.checked)}
        label={t('backupImportConfirmNewCompany')}
        containerClassName="nx-checkbox text-[13px] text-noorix-text mt-3 mb-2 leading-[1.5]"
      />

      <Checkbox
        checked={importStrictAlloc}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setImportStrictAlloc(event.target.checked)}
        label={t('backupImportStrictAllocations')}
        containerClassName="nx-checkbox text-[13px] text-noorix-text mb-1 leading-[1.5]"
      />
      <p className="text-[12px] text-noorix-muted m-0 mb-4 leading-snug">
        {t('backupImportStrictAllocationsHint')}
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full min-h-[44px] sm:w-auto"
          disabled={importMut.isPending}
          onClick={closeSheet}
        >
          {t('cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="w-full min-h-[44px] sm:w-auto"
          disabled={importMut.isPending || !importNameAr.trim() || !importConfirmed}
          onClick={() =>
            importModal &&
            importMut.mutate({
              jobId: importModal.jobId,
              nameAr: importNameAr.trim(),
              failOnAllocationWarnings: importStrictAlloc,
            })
          }
        >
          {importMut.isPending ? t('loading') : t('backupImportRun')}
        </Button>
      </div>
    </AdaptiveSheet>
  );
}
