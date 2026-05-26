import type { ApiParsedResult } from '../../../types/api';
import { apiPatch, apiPost } from '../../../services/core/apiHttp';
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

function extractCreatedSummaryId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const summary = (root.summary ?? root) as Record<string, unknown>;
  return typeof summary.id === 'string' ? summary.id : null;
}

/** بعد حفظ قديم بدون shift — محاولة PATCH إن كان الخادم يدعم التعديل */
async function tryPatchShiftAfterLegacyCreate(
  summaryId: string,
  companyId: string,
  shift: SalesShiftValue,
): Promise<boolean> {
  const res = await apiPatch(
    `/api/v1/sales/summaries/${summaryId}?companyId=${encodeURIComponent(companyId)}`,
    { shift },
  );
  return !!res.success;
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
      const companyId = String(rest.companyId ?? body.companyId ?? '');
      const summaryId = extractCreatedSummaryId(legacy.data);
      let shiftPatched = false;
      if (summaryId && companyId && isSalesShiftValue(shift)) {
        shiftPatched = await tryPatchShiftAfterLegacyCreate(summaryId, companyId, shift);
      }
      return { ...legacy, usedLegacyNoShift: !shiftPatched };
    }
    return legacy;
  }

  return res;
}
