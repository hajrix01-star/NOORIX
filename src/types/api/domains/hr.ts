export type HrEmployeeTab = 'active' | 'terminated' | 'archived';

export type HrEmployeeStatus = HrEmployeeTab | string;

export type HrEmployee = {
  id: string;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  employeeSerial?: string | number | null;
  employeeNumber?: string | number | null;
  jobTitle?: string | null;
  iqamaNumber?: string | null;
  joinDate?: string | null;
  status?: HrEmployeeStatus | null;
  basicSalary?: number | string | null;
  housingAllowance?: number | string | null;
  transportAllowance?: number | string | null;
  otherAllowance?: number | string | null;
  workHours?: string | null;
  workSchedule?: string | null;
  notes?: string | null;
  [key: string]: unknown;
};

export type HrEmployeesPagedResult = {
  items: HrEmployee[];
  total: number;
  page: number;
  pageSize: number;
};

export type HrSalaryPackageSnapshot = {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowance: number;
  customAllowanceTotal: number;
  overtimeHoursPerDay: number;
  overtimePay: number;
  fixedTotal: number;
  total: number;
};

export type HrCompensationSnapshot = {
  source?: string;
  companyId?: string;
  employeeId: string;
  calculatedAt?: string;
  salaryPackage: HrSalaryPackageSnapshot;
  customAllowances?: {
    total?: number;
    items?: Array<{
      id?: string | null;
      nameAr?: string | null;
      nameEn?: string | null;
      amount?: number | string | null;
    }>;
  };
  [key: string]: unknown;
};

export type HrCompensationSnapshotsResult = {
  items: HrCompensationSnapshot[];
};

export type HrMoneyLike = number | string | null | undefined;

export type HrMutationPayload = Record<string, unknown>;

export type HrDocumentUploadResult = Record<string, unknown>;
