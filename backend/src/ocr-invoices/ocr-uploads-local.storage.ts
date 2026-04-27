import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { Injectable } from '@nestjs/common';
import { UPLOADS_ROOT } from '../common/uploads-root';

/** Relative POSIX paths under `uploads/` (OCR today; HR/attachments can reuse). */
export interface OcrUploadsStorage {
  writeBuffer(relativePosixPath: string, data: Buffer): Promise<void>;
  readBuffer(relativePosixPath: string): Promise<Buffer>;
  resolveAbsolute(relativePosixPath: string): string;
  ensureParentDir(relativePosixPath: string): void;
  exists(relativePosixPath: string): boolean;
}

@Injectable()
export class OcrUploadsLocalStorage implements OcrUploadsStorage {
  private readonly baseDir = UPLOADS_ROOT;

  resolveAbsolute(relativePosixPath: string): string {
    const rel = relativePosixPath.replace(/\\/g, '/');
    return join(this.baseDir, ...rel.split('/').filter(Boolean));
  }

  ensureParentDir(relativePosixPath: string): void {
    const abs = this.resolveAbsolute(relativePosixPath);
    mkdirSync(dirname(abs), { recursive: true });
  }

  async writeBuffer(relativePosixPath: string, data: Buffer): Promise<void> {
    this.ensureParentDir(relativePosixPath);
    await writeFile(this.resolveAbsolute(relativePosixPath), data);
  }

  async readBuffer(relativePosixPath: string): Promise<Buffer> {
    return readFile(this.resolveAbsolute(relativePosixPath));
  }

  exists(relativePosixPath: string): boolean {
    return existsSync(this.resolveAbsolute(relativePosixPath));
  }
}
