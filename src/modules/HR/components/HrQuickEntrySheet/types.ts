export type HrQuickEntryMode = 'advance' | 'leave' | 'deduction' | 'increase';

export type HrQuickEntryRecordedPayload = { textAr: string; textEn: string };

export type HrQuickEntrySheetProps = {
  mode: HrQuickEntryMode;
  companyId: string;
  onClose: () => void;
  onRecorded?: (o: HrQuickEntryRecordedPayload) => void;
  variant?: string;
};

export type EmployeeOption = {
  id?: string;
  status?: string;
  name?: string;
  nameAr?: string;
};
