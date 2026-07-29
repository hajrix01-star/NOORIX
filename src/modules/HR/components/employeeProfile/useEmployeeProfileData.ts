import { useEffect, useMemo, useState } from 'react';
import { useApiListQuery, useApiQuery } from '../../../../hooks/useApiQuery';
import { useEmployee } from '../../../../hooks/useEmployees';
import {
  buildLeaveRequestStatusMap,
  buildPayrollRunStatusMap,
  buildResidencyRecordStatusMap,
} from '../../../../constants/badgeMaps';
import {
  getDeductions,
  getDocuments,
  getEmployeeCompensationSnapshot,
  getEmployeePhotoObjectUrl,
  getInvoices,
  getLeaves,
  getMovements,
  getResidencies,
  unwrapApiList,
} from '../../../../services/api';
import { hrKeys, invoiceKeys } from '../../../../services/queryKeys';
import type { HrCompensationSnapshot } from '../../../../types/api';
import { normalizeAdvances } from '../../utils/advanceBalance';
import {
  buildCareerTableRows,
  buildEmployeeProfileSummary,
  buildFinancialRecords,
  buildSalaryRows,
  type PayrollProfileItem,
  type ProfileRecord,
} from './employeeProfileModel';

export type HrProfileCompensationSnapshot = HrCompensationSnapshot & {
  advances?: { items?: ProfileRecord[] };
  payrollItems?: PayrollProfileItem[];
  customAllowances?: HrCompensationSnapshot['customAllowances'];
};

type UseEmployeeProfileDataParams = {
  employeeId?: string;
  companyId: string;
  t: (key: string, ...args: unknown[]) => string;
};

export function useEmployeeProfileData({ employeeId, companyId, t }: UseEmployeeProfileDataParams) {
  const [employeePhotoUrl, setEmployeePhotoUrl] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const { data: employee, isLoading, error } = useEmployee(employeeId, companyId);

  const {
    data: compensationSnapshot,
    isLoading: isCompensationSnapshotLoading,
    error: compensationSnapshotError,
  } = useApiQuery<HrProfileCompensationSnapshot>({
    queryKey: hrKeys.compensationSnapshot(companyId, employeeId),
    queryFn: async () => {
      if (!employeeId) throw new Error('Employee id is required.');
      return getEmployeeCompensationSnapshot(companyId, employeeId);
    },
    enabled: !!companyId && !!employeeId,
    fallbackMessage: 'فشل تحميل بيانات HR المركزية',
  });

  const leaveProfileStatusMap = useMemo(() => buildLeaveRequestStatusMap(t), [t]);
  const residencyProfileStatusMap = useMemo(() => buildResidencyRecordStatusMap(t), [t]);
  const payrollRunStatusMap = useMemo(() => buildPayrollRunStatusMap(t), [t]);

  const { data: leaves = [], error: leavesError } = useApiListQuery<ProfileRecord>({
    queryKey: hrKeys.leavesByEmployee(companyId, employeeId),
    queryFn: () => getLeaves(companyId, employeeId),
    fallbackMessage: 'فشل تحميل إجازات الموظف',
    enabled: !!companyId && !!employeeId,
  });

  const { data: residencies = [], error: residenciesError } = useApiListQuery<ProfileRecord>({
    queryKey: hrKeys.residenciesByEmployee(companyId, employeeId),
    queryFn: () => getResidencies(companyId, employeeId),
    fallbackMessage: 'فشل تحميل خدمات الموظف',
    enabled: !!companyId && !!employeeId,
  });

  const { data: documents = [], error: documentsError } = useApiListQuery<ProfileRecord, ProfileRecord[]>({
    queryKey: hrKeys.documents(companyId, employeeId),
    queryFn: () => getDocuments(companyId, employeeId),
    fallbackMessage: 'فشل تحميل مستندات الموظف',
    select: (items) =>
      [...items].sort((a, b) => {
        const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bd - ad;
      }),
    enabled: !!companyId && !!employeeId,
  });

  const { data: hrInvoicesData, error: hrInvoicesError } = useApiQuery<{ items: ProfileRecord[] }>({
    queryKey: invoiceKeys.hrAllForEmployee(companyId, employeeId),
    queryFn: async () => {
      const [advRes, hrRes, salRes] = await Promise.all([
        getInvoices(companyId, undefined, undefined, 1, 100, null, employeeId, 'advance', undefined, undefined, undefined, undefined, undefined, undefined, undefined, false),
        getInvoices(companyId, undefined, undefined, 1, 100, null, employeeId, 'hr_expense', undefined, undefined, undefined, undefined, undefined, undefined, undefined, false),
        getInvoices(companyId, undefined, undefined, 1, 100, null, employeeId, 'salary', undefined, undefined, undefined, undefined, undefined, undefined, undefined, false),
      ]);
      const items: ProfileRecord[] = [];
      items.push(
        ...unwrapApiList<ProfileRecord>(advRes, 'فشل تحميل سلف الموظف').filter((i) => i.kind === 'advance' && i.status !== 'cancelled'),
        ...unwrapApiList<ProfileRecord>(hrRes, 'فشل تحميل مصروفات HR للموظف').filter((i) => i.kind === 'hr_expense' && i.status !== 'cancelled'),
        ...unwrapApiList<ProfileRecord>(salRes, 'فشل تحميل رواتب الموظف').filter((i) => i.kind === 'salary' && i.status !== 'cancelled'),
      );
      return { success: true, data: { items } };
    },
    enabled: !!companyId && !!employeeId,
    fallbackMessage: 'فشل تحميل فواتير الموظف',
  });

  const { data: deductions = [], error: deductionsError } = useApiListQuery<ProfileRecord>({
    queryKey: hrKeys.deductions(companyId, employeeId),
    queryFn: () => getDeductions(companyId, employeeId),
    fallbackMessage: 'فشل تحميل خصومات الموظف',
    enabled: !!companyId && !!employeeId,
  });

  const { data: movements = [], error: movementsError } = useApiListQuery<ProfileRecord>({
    queryKey: hrKeys.movementsByEmployee(companyId, employeeId),
    queryFn: () => getMovements(companyId, employeeId),
    fallbackMessage: 'فشل تحميل حركات الموظف',
    enabled: !!companyId && !!employeeId,
  });

  const careerTableRows = useMemo(() => buildCareerTableRows(movements, t), [movements, t]);
  const financialRecords = useMemo(
    () => buildFinancialRecords(hrInvoicesData, deductions, t, residencies),
    [hrInvoicesData, deductions, t, residencies],
  );

  useEffect(() => {
    if (!employee?.id || !companyId || !employee.photoPath) {
      setEmployeePhotoUrl('');
      setPhotoLoading(false);
      return undefined;
    }
    let alive = true;
    let objectUrl = '';
    setPhotoLoading(true);
    getEmployeePhotoObjectUrl(employee.id, companyId)
      .then((url) => {
        objectUrl = url;
        if (alive) setEmployeePhotoUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch(() => {
        if (alive) setEmployeePhotoUrl('');
      })
      .finally(() => {
        if (alive) setPhotoLoading(false);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [companyId, employee?.id, employee?.photoPath]);

  const salaryRows = compensationSnapshot ? buildSalaryRows(compensationSnapshot, t) : [];
  const advances = normalizeAdvances(compensationSnapshot?.advances?.items ?? []);
  const payrollItems = compensationSnapshot?.payrollItems ?? [];
  const profileSummary = compensationSnapshot
    ? buildEmployeeProfileSummary({
        compensationSnapshot,
        advances,
        payrollItems,
        leaves,
        residencies,
        documents,
        careerTableRows,
      })
    : null;

  return {
    employee,
    isLoading,
    error,
    compensationSnapshot,
    isCompensationSnapshotLoading,
    compensationSnapshotError,
    profileSectionError: leavesError || residenciesError || documentsError || hrInvoicesError || deductionsError || movementsError,
    leaveProfileStatusMap,
    residencyProfileStatusMap,
    payrollRunStatusMap,
    leaves,
    residencies,
    documents,
    deductions,
    movements,
    careerTableRows,
    financialRecords,
    employeePhotoUrl,
    setEmployeePhotoUrl,
    photoLoading,
    salaryRows,
    advances,
    payrollItems,
    profileSummary,
  };
}
