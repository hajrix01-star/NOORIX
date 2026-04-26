import type { Request } from 'express';

/** يطابق ترتيب CompanyAccessGuard لاستخراج companyId من الطلب */
export function getCompanyIdFromHttpRequest(request: Request): string {
  const method = (request.method || '').toUpperCase();
  const readFromBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
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
