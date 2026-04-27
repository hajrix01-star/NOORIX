import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

export function uploadsAbsolutePath(...segments: string[]): string {
  return join(UPLOADS_ROOT, ...segments);
}

export function ensureUploadsSubdir(...segments: string[]): string {
  const dir = uploadsAbsolutePath(...segments);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
