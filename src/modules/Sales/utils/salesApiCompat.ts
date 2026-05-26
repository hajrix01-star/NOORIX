import type { ApiParsedResult } from '../../../types/api';
import { apiPost } from '../../../services/core/apiHttp';
import type { SalesShiftValue } from '../constants/salesShift';
import { formatShiftNoteTag, isSalesShiftValue } from '../constants/salesShift';

/** خادم قديم: forbidNonWhitelisted — property shift should not exist */
export function isShiftPropertyRejected(error: unknown): boolean {
  const msg = String(error ?? '').toLowerCase();
  return (
    msg.includes('shift')
    && (msg.includes('should not exist')
      || msg.includes('should not be')
      || msg.includes('property shift'))
  );
}

function appendShiftToNotes(notes: unknown, shift: SalesShiftValue): string {
  const line = formatShiftNoteTag(shift);
  const base = typeof notes === 'string' ? notes.trim() : '';
  return base ? `${base}\n${line}` : line;
}

/**
 * POST /sales/summary مع تراجع: إن رُفض حقل shift يُعاد الطلب بدونه (خادم قديم).
 * يُضاف الشفت في الملاحظات فقط — لتفعيل الشفت في DB يجب تحديث الخادم.
 */
export async function postSalesSummaryWithCompat(
  body: Record<string, unknown>,
): Promise<ApiParsedResult & { usedLegacyNoShift?: boolean }> {
  const res = await apiPost('/api/v1/sales/summary', body);
  if (res.success) return res;

  const shift = body.shift;
  if (res.code === 400 && shift && isSalesShiftValue(shift) && isShiftPropertyRejected(res.error)) {
    const { shift: _s, idempotencyKey: _k, ...rest } = body;
    const legacyBody = {
      ...rest,
      notes: appendShiftToNotes(rest.notes, shift),
    };
    const legacy = await apiPost('/api/v1/sales/summary', legacyBody);
    if (legacy.success) {
      return { ...legacy, usedLegacyNoShift: true };
    }
    return legacy;
  }

  return res;
}
