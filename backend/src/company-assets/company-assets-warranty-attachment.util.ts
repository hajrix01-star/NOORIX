import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'fs';

export function sendWarrantyAttachmentFile(
  asset: {
    warrantyAttachmentPath: string | null;
    warrantyAttachmentOriginalName: string | null;
    warrantyAttachmentMime: string | null;
  } | null,
  res: Response,
): void {
  const p = asset?.warrantyAttachmentPath?.trim();
  if (!asset || !p) {
    throw new NotFoundException('Ù„Ø§ ØªÙˆØ¬Ø¯ ØµÙˆØ±Ø© Ø¶Ù…Ø§Ù† Ù„Ù‡Ø°Ø§ Ø§Ù„Ø£ØµÙ„.');
  }
  if (!existsSync(p)) {
    throw new NotFoundException('ØµÙˆØ±Ø© Ø§Ù„Ø¶Ù…Ø§Ù† ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù….');
  }

  const name = asset.warrantyAttachmentOriginalName?.trim() || 'warranty-image';
  res.setHeader('Content-Type', asset.warrantyAttachmentMime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.sendFile(p);
}
