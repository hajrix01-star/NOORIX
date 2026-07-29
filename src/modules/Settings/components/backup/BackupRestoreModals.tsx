import { type ChangeEvent } from 'react';
import { Button, Input, Modal } from '../../../../ui';
import type {
  BackupRestoreModal,
  BackupRestorePcModal,
  BackupRestorePcVariables,
  BackupRestoreVariables,
  SettingsMutationLike,
  TranslationFn,
} from '../../settingsTypes';

type BackupRestoreModalsProps = {
  t: TranslationFn;
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

export function BackupRestoreModals({
  t,
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
}: BackupRestoreModalsProps) {
  return (
    <>
      <Modal
        open={!!restorePcModal}
        onClose={() =>
          !restorePcMut.isPending && (setRestorePcModal(null), setRestorePcPhrase(''))
        }
        title={t('backupSystemRestoreFromPc')}
        size="md"
        variant="danger"
      >
        <div
          className="text-[13px] font-medium py-[10px] px-[14px] mb-3 rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
          role="alert"
        >
          {t('backupSystemRestoreFromPcWarn')}
        </div>
        <p className="text-[12px] text-noorix-muted m-0 mb-2 leading-[1.6]">
          {restorePcModal?.file?.name ? (
            <span dir="ltr" className="font-mono break-all">
              {restorePcModal.file.name}
            </span>
          ) : null}
        </p>
        <p className="text-[12px] text-noorix-muted m-0 mb-3 leading-[1.6]">{t('backupSystemRestorePhraseHint')}</p>
        <Input
          type="text"
          label={t('backupSystemRestorePhraseLabel')}
          value={restorePcPhrase}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setRestorePcPhrase(event.target.value)}
          className="nx-ltr"
          dir="ltr"
          autoComplete="off"
        />
        <p className="text-[11px] text-noorix-muted mt-2 m-0">{t('backupRestoreExitHint')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end mt-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restorePcMut.isPending}
            onClick={() => (setRestorePcModal(null), setRestorePcPhrase(''))}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restorePcMut.isPending || !restorePcPhrase.trim() || !restorePcModal?.file}
            onClick={() =>
              restorePcModal?.file &&
              restorePcMut.mutate({
                file: restorePcModal.file,
                confirmPhrase: restorePcPhrase.trim(),
              })
            }
          >
            {restorePcMut.isPending ? t('loading') : t('backupSystemRestoreConfirm')}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!restoreModal}
        onClose={() => !restoreMut.isPending && (setRestoreModal(null), setRestorePhrase(''))}
        title={t('backupSystemRestore')}
        size="md"
        variant="danger"
      >
        <div
          className="text-[13px] font-medium py-[10px] px-[14px] mb-3 rounded-md leading-[1.65] bg-noorix-red/10 border border-noorix-red/45 text-noorix-red"
          role="alert"
        >
          {t('backupSystemRestoreWarn')}
        </div>
        <p className="text-[12px] text-noorix-muted m-0 mb-3 leading-[1.6]">{t('backupSystemRestorePhraseHint')}</p>
        <Input
          type="text"
          label={t('backupSystemRestorePhraseLabel')}
          value={restorePhrase}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setRestorePhrase(event.target.value)}
          className="nx-ltr"
          dir="ltr"
          autoComplete="off"
        />
        <p className="text-[11px] text-noorix-muted mt-2 m-0">{t('backupRestoreExitHint')}</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end mt-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restoreMut.isPending}
            onClick={() => (setRestoreModal(null), setRestorePhrase(''))}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={restoreMut.isPending || !restorePhrase.trim()}
            onClick={() =>
              restoreModal &&
              restoreMut.mutate({ jobId: restoreModal.jobId, confirmPhrase: restorePhrase.trim() })
            }
          >
            {restoreMut.isPending ? t('loading') : t('backupSystemRestoreConfirm')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
