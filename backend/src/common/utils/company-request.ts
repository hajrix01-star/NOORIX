import type { Request } from 'express';

/**
 * استخراج companyId للـ GET (وما شابه) مع أولوية query على الهيدر.
 * يتوافق مع CompanyAccessGuard (query قبل x-company-id).
 * يمنع إرجاع بيانات شركة خاطئة عندما يتأخر تحديث x-company-id في الواجهة عن ?companyId.
 */
export function preferQueryCompanyId(query?: string, header?: string): string {
  const q = query?.trim();
  if (q) return q;
  return header?.trim() || '';
}

/** يطابق ترتيب CompanyAccessGuard لاستخراج companyId من الطلب */
export function getCompanyIdFromHttpRequest(request: Request): string {
  const method = (request.method || '').toUpperCase();
  const readFromBody = method === 'POST' || method === 'PUT';
  const body = request.body as { companyId?: string } | undefined;
  const headerVal = request.headers['x-company-id'];
  const headerStr = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  const q = request.query as { companyId?: string };
  const raw =
    (readFromBody ? body?.companyId : undefined) ||
    (request.params as { companyId?: string })?.companyId ||
    (q?.companyId != null ? String(q.companyId) : '') ||
    headerStr ||
    '';
  return String(raw).trim();
}
