function normalizeText(v: unknown) {
  return String(v ?? '').trim();
}

/**
 * جسم PATCH لتحديث الشركة — الحقول النصية المتغيرة فقط + nameAr إلزامي في الطلب.
 */
export function buildCompanyUpdateBody(editModal: Record<string, unknown> | null | undefined) {
  const initial = (editModal?._initial as Record<string, unknown> | undefined) || {};
  const nameAr = normalizeText(editModal?.nameAr);

  const current = {
    nameEn: normalizeText(editModal?.nameEn),
    taxNumber: normalizeText(editModal?.taxNumber),
    phone: normalizeText(editModal?.phone),
    address: normalizeText(editModal?.address),
    email: normalizeText(editModal?.email),
    logoUrl: normalizeText(editModal?.logoUrl),
  };
  const baseline = {
    nameEn: normalizeText(initial.nameEn),
    taxNumber: normalizeText(initial.taxNumber),
    phone: normalizeText(initial.phone),
    address: normalizeText(initial.address),
    email: normalizeText(initial.email),
    logoUrl: normalizeText(initial.logoUrl),
  };

  const body: Record<string, unknown> = { nameAr };
  if (current.nameEn !== baseline.nameEn) body.nameEn = current.nameEn;
  if (current.taxNumber !== baseline.taxNumber) body.taxNumber = current.taxNumber;
  if (current.phone !== baseline.phone) body.phone = current.phone;
  if (current.address !== baseline.address) body.address = current.address;
  if (current.email !== baseline.email) body.email = current.email;
  if (current.logoUrl !== baseline.logoUrl) body.logoUrl = current.logoUrl;

  return body;
}

/** دمج استجابة الخادم مع الطلب لتحديث كاش React Query */
export function mergeCompanySavePatch(
  apiResult: { data?: unknown } | null | undefined,
  variables: { id?: string; body?: Record<string, unknown> } | null | undefined,
): { id: string; patch: Record<string, unknown> } | null {
  const id = variables?.id;
  if (!id) return null;

  const requested = variables?.body && typeof variables.body === 'object' ? { ...variables.body } : {};
  const saved =
    apiResult?.data && typeof apiResult.data === 'object' && !Array.isArray(apiResult.data)
      ? (apiResult.data as Record<string, unknown>)
      : null;

  const patch: Record<string, unknown> = saved ? { ...requested, ...saved } : { ...requested };
  return { id, patch };
}
