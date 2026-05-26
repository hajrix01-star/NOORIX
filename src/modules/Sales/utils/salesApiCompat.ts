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

type CreatedSummaryMeta = {
  id: string | null;
  shift: unknown;
  notes: unknown;
};

function extractCreatedSummary(data: unknown): CreatedSummaryMeta {
  if (!data || typeof data !== 'object') {
    return { id: null, shift: undefined, notes: undefined };
  }
  const root = data as Record<string, unknown>;
  const summary = (root.summary ?? root) as Record<string, unknown>;
  return {
    id: typeof summary.id === 'string' ? summary.id : null,
    shift: summary.shift,
    notes: summary.notes,
  };
}

/** PATCH خفيف — يعمل بعد النشر حتى لو الإنشاء حذف shift بصمت */
async function tryPatchShiftOnly(
  summaryId: string,
  companyId: string,
  shift: SalesShiftValue,
): Promise<boolean> {
  const q = `companyId=${encodeURIComponent(companyId)}`;
  const shiftOnly = await apiPatch(
    `/api/v1/sales/summaries/${summaryId}/shift?${q}`,
    { shift },
  );
  if (shiftOnly.success) return true;
  const full = await apiPatch(
    `/api/v1/sales/summaries/${summaryId}?${q}`,
    { shift },
  );
  return !!full.success;
}

async function reconcileShiftAfterCreate(
  body: Record<string, unknown>,
  res: ApiParsedResult,
): Promise<{ usedLegacyNoShift: boolean }> {
  const requested = body.shift;
  if (!isSalesShiftValue(requested) || requested === 'all') {
    return { usedLegacyNoShift: false };
  }
  const { id, shift: saved } = extractCreatedSummary(res.data);
  const companyId = String(body.companyId ?? '');
  if (!id || !companyId) return { usedLegacyNoShift: true };
  if (saved === requested) return { usedLegacyNoShift: false };

  const patched = await tryPatchShiftOnly(id, companyId, requested);
  return { usedLegacyNoShift: !patched };
}

/**
 * POST /sales/summary مع تراجع: إن رُفض حقل shift يُعاد الطلب بدونه (خادم قديم).
 * يُضاف الشفت في الملاحظات فقط — لتفعيل الشفت في DB يجب تحديث الخادم.
 */
export async function postSalesSummaryWithCompat(
  body: Record<string, unknown>,
): Promise<ApiParsedResult & { usedLegacyNoShift?: boolean }> {
  const res = await apiPost('/api/v1/sales/summary', body);
  if (res.success) {
    const { usedLegacyNoShift } = await reconcileShiftAfterCreate(body, res);
    return { ...res, usedLegacyNoShift };
  }

  const shift = body.shift;
  if (res.code === 400 && shift && isSalesShiftValue(shift) && isShiftPropertyRejected(res.error)) {
    const { shift: _s, idempotencyKey: _k, ...rest } = body;
    const legacyBody = {
      ...rest,
      notes: appendShiftToNotes(rest.notes, shift),
    };
    const legacy = await apiPost('/api/v1/sales/summary', legacyBody);
    if (legacy.success) {
      const { usedLegacyNoShift } = await reconcileShiftAfterCreate(
        { ...legacyBody, shift, companyId: rest.companyId ?? body.companyId },
        legacy,
      );
      return { ...legacy, usedLegacyNoShift };
    }
    return legacy;
  }

  return res;
}
