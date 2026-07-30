export type StaffSaleEditPolicyRecord = {
  id: string;
  logRef?: string | null;
};

export function staffSaleEditScopeKey(record: StaffSaleEditPolicyRecord): string {
  return record.logRef?.trim() || record.id;
}

export function isPrivilegedStaffOrderRole(role?: string): boolean {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'owner' || normalized === 'super_admin';
}

export function canEditStaffSaleRecordByLatest({
  target,
  latest,
  role,
}: {
  target: StaffSaleEditPolicyRecord;
  latest: StaffSaleEditPolicyRecord | null;
  role?: string;
}): boolean {
  if (isPrivilegedStaffOrderRole(role)) return true;
  if (!latest) return true;
  return staffSaleEditScopeKey(target) === staffSaleEditScopeKey(latest);
}
