export const TYPE_MAP: Record<string, string> = {
  annual: 'leaveAnnual',
  sick: 'leaveSick',
  unpaid: 'leaveUnpaid',
  other: 'leaveOther',
};

export const MODE_META = {
  advance: { icon: '', labelAr: 'صرف سلفة', labelEn: 'Pay advance' },
  leave: { icon: '', labelAr: 'تسجيل إجازة', labelEn: 'Add leave' },
  deduction: { icon: '', labelAr: 'تسجيل خصم', labelEn: 'Record deduction' },
  increase: { icon: '', labelAr: 'زيادة أو بدلة', labelEn: 'Raise or allowance' },
} as const;

export const inputBase = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid var(--noorix-border)',
  background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
};
