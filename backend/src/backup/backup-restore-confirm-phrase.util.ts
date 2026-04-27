import { ForbiddenException } from '@nestjs/common';

const DEFAULT_PHRASE = 'RESTORE_NOORIX_FULL_DB';

export function assertBackupRestoreConfirmPhrase(confirmPhrase: string): void {
  const expected = process.env.BACKUP_RESTORE_CONFIRM_PHRASE || DEFAULT_PHRASE;
  if (confirmPhrase !== expected) {
    throw new ForbiddenException('عبارة التأكيد غير صحيحة.');
  }
}
