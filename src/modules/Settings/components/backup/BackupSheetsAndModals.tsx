import type {
  BackupImportModal,
  BackupImportReport,
  BackupImportVariables,
  BackupReportModal,
  BackupRestoreModal,
  BackupRestorePcModal,
  BackupRestorePcVariables,
  BackupRestoreVariables,
  SettingsMutationLike,
  TranslationFn,
} from '../../settingsTypes';
import { BackupImportCompanySheet } from './BackupImportCompanySheet';
import { BackupImportReportSheet, BackupRestoreReportSheet } from './BackupReportSheets';
import { BackupRestoreModals } from './BackupRestoreModals';

type BackupSheetsAndModalsProps = {
  t: TranslationFn;
  lang: string;
  isAr: boolean;
  importModal: BackupImportModal | null;
  setImportModal: (value: BackupImportModal | null) => void;
  importMut: SettingsMutationLike<BackupImportVariables>;
  importNameAr: string;
  setImportNameAr: (value: string) => void;
  importConfirmed: boolean;
  setImportConfirmed: (value: boolean) => void;
  importStrictAlloc: boolean;
  setImportStrictAlloc: (value: boolean) => void;
  reportModal: BackupReportModal | null;
  setReportModal: (value: BackupReportModal | null) => void;
  importReportModal: BackupImportReport | null;
  setImportReportModal: (value: BackupImportReport | null) => void;
  restorePcModal: BackupRestorePcModal | null;
  setRestorePcModal: (value: BackupRestorePcModal | null) => void;
  restorePcPhrase: string;
  setRestorePcPhrase: (value: string) => void;
  restorePcMut: SettingsMutationLike<BackupRestorePcVariables>;
  restoreModal: BackupRestoreModal | null;
  setRestoreModal: (value: BackupRestoreModal | null) => void;
  restorePhrase: string;
  setRestorePhrase: (value: string) => void;
  restoreMut: SettingsMutationLike<BackupRestoreVariables>;
};

export function BackupSheetsAndModals({
  t,
  lang,
  isAr,
  importModal,
  setImportModal,
  importMut,
  importNameAr,
  setImportNameAr,
  importConfirmed,
  setImportConfirmed,
  importStrictAlloc,
  setImportStrictAlloc,
  reportModal,
  setReportModal,
  importReportModal,
  setImportReportModal,
  restorePcModal,
  setRestorePcModal,
  restorePcPhrase,
  setRestorePcPhrase,
  restorePcMut,
  restoreModal,
  setRestoreModal,
  restorePhrase,
  setRestorePhrase,
  restoreMut,
}: BackupSheetsAndModalsProps) {
  return (
    <>
      <BackupImportCompanySheet
        t={t}
        importModal={importModal}
        setImportModal={setImportModal}
        importMut={importMut}
        importNameAr={importNameAr}
        setImportNameAr={setImportNameAr}
        importConfirmed={importConfirmed}
        setImportConfirmed={setImportConfirmed}
        importStrictAlloc={importStrictAlloc}
        setImportStrictAlloc={setImportStrictAlloc}
      />

      <BackupRestoreReportSheet
        t={t}
        lang={lang}
        isAr={isAr}
        reportModal={reportModal}
        setReportModal={setReportModal}
      />

      <BackupImportReportSheet
        t={t}
        lang={lang}
        importReportModal={importReportModal}
        setImportReportModal={setImportReportModal}
      />

      <BackupRestoreModals
        t={t}
        restorePcModal={restorePcModal}
        setRestorePcModal={setRestorePcModal}
        restorePcPhrase={restorePcPhrase}
        setRestorePcPhrase={setRestorePcPhrase}
        restorePcMut={restorePcMut}
        restoreModal={restoreModal}
        setRestoreModal={setRestoreModal}
        restorePhrase={restorePhrase}
        setRestorePhrase={setRestorePhrase}
        restoreMut={restoreMut}
      />
    </>
  );
}
