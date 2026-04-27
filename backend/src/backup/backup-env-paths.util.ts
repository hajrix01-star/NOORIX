import * as path from 'path';

/** استخراج معرّف مجلد Google Drive من رابط أو نص معرّف */
export function parseDriveFolderId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m1 = s.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/drive\.google\.com\/open\?[^#]*\bid=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_-]{8,128}$/.test(s)) return s;
  return null;
}

export function getBackupRoot(cwd: string = process.cwd()): string {
  const raw = process.env.BACKUP_LOCAL_DIR || path.join(cwd, 'data', 'backups');
  return path.resolve(raw);
}
