import { existsSync } from 'fs';
import { unlink } from 'fs/promises';

const EMPLOYEE_PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function isEmployeePhotoMime(mime: string | undefined): boolean {
  return EMPLOYEE_PHOTO_MIMES.has(mime || '');
}

export async function removeStoredEmployeePhoto(photoPath: string | null | undefined): Promise<void> {
  if (!photoPath || !photoPath.includes('employee-photos')) return;
  if (!existsSync(photoPath)) return;
  await unlink(photoPath).catch(() => undefined);
}
