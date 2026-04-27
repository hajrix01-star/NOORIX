import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

/**
 * أرشفة مرفقات (مسارات نسبية تحت cwd التطبيق) في ملف .tar.gz.
 */
export async function createAttachmentsTarball(
  manifest: { relativePath: string; sizeBytes: number }[],
  outputAbs: string,
): Promise<void> {
  const cwd = process.cwd();
  const files = manifest
    .map((m) => String(m.relativePath || '').replace(/\\/g, '/'))
    .filter((f) => f.length > 0 && !f.includes('..'));
  if (files.length === 0) return;
  await fs.mkdir(path.dirname(outputAbs), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-czf', outputAbs, '-C', cwd, ...files], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`tar: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`فشل أرشفة مرفقات الفواتير: ${err || 'رمز ' + code}`));
    });
  });
}
