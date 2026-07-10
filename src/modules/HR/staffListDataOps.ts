import type { QueryClient } from '@tanstack/react-query';
import {
  createCustomAllowance,
  deleteCustomAllowance,
  getCustomAllowances,
  getEmployeeCompensationSnapshots,
  throwIfApiFailed,
} from '../../services/api';
import {
  EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS,
  formatEmployeeForExport,
} from '../../utils/importTemplates';
import { moneyAmountsEqual, roundMoney2 } from '../../utils/moneyInput';
import { employeeKeys, hrKeys } from '../../services/queryKeys';
import type { HrCompensationSnapshot, HrEmployee } from '../../types/api';

type Translate = (key: string) => string;

export type HrCustomAllowanceEditRow = {
  id?: string;
  nameAr: string;
  amount: unknown;
};

export type HrStaffSavePayload = {
  employeeBody: Record<string, unknown>;
  customAllowances?: HrCustomAllowanceEditRow[];
};

export function getCreatedEmployeeId(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const root = result as { data?: unknown; id?: unknown };
  if (root.data && typeof root.data === 'object') {
    const data = root.data as { id?: unknown };
    if (typeof data.id === 'string') return data.id;
  }
  if (typeof root.id === 'string') return root.id;
  return '';
}

export async function buildCentralEmployeeExportRows(
  companyId: string,
  list: HrEmployee[],
  t: Translate,
) {
  const ids = list.map((row) => row.id).filter(Boolean);
  const res = await getEmployeeCompensationSnapshots(companyId, ids);
  throwIfApiFailed(res, t('employeesLoadFailed'));
  const snapshots = (res.data?.items ?? []) as HrCompensationSnapshot[];
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.employeeId, snapshot]));
  const allowanceTotals = new Map<string, number>(
    snapshots.map((snapshot) => {
      const customAllowanceTotal = Number(snapshot?.salaryPackage?.customAllowanceTotal);
      if (!Number.isFinite(customAllowanceTotal)) {
        throw new Error(t('employeesLoadFailed'));
      }
      return [snapshot.employeeId, customAllowanceTotal];
    }),
  );
  const customColumn = EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS[4];
  const overtimeColumn = EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS[5];
  const totalColumn = EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS[6];

  return list.map((employee) => {
    const snapshot = snapshotMap.get(employee.id);
    if (!snapshot?.salaryPackage) {
      throw new Error(t('employeesLoadFailed'));
    }
    return {
      ...formatEmployeeForExport(employee, allowanceTotals),
      [customColumn]: snapshot.salaryPackage.customAllowanceTotal,
      [overtimeColumn]: snapshot.salaryPackage.overtimePay,
      [totalColumn]: snapshot.salaryPackage.total,
    };
  });
}

export async function syncCustomAllowanceRows(input: {
  companyId: string;
  employeeId: string;
  desiredRows?: HrCustomAllowanceEditRow[];
  queryClient: QueryClient;
  t: Translate;
}) {
  const { companyId, employeeId, desiredRows = [], queryClient, t } = input;
  if (!companyId || !employeeId) {
    throw new Error(t('customAllowanceMissingEmployeeId'));
  }
  const res = await getCustomAllowances(companyId, employeeId);
  throwIfApiFailed(res, t('loadingError'));
  const currentRows = (Array.isArray(res?.data) ? res.data : (res?.data?.items ?? [])) as HrCustomAllowanceEditRow[];
  const currentById = new Map(currentRows.filter((row) => row.id).map((row) => [row.id as string, row]));
  const desiredIds = new Set(desiredRows.filter((row) => row.id).map((row) => row.id));

  for (const currentRow of currentRows) {
    const desiredRow = desiredRows.find((row) => row.id === currentRow.id);
    const changed = desiredRow
      && (desiredRow.nameAr !== currentRow.nameAr || !moneyAmountsEqual(desiredRow.amount, currentRow.amount));
    if (!currentRow.id) continue;
    if (!desiredIds.has(currentRow.id) || changed) {
      const delRes = await deleteCustomAllowance(currentRow.id, companyId);
      throwIfApiFailed(delRes, t('deleteFailed'));
    }
  }

  for (const row of desiredRows) {
    const existing = row.id ? currentById.get(row.id) as { nameAr?: string; amount?: unknown } | undefined : null;
    const changed = existing
      && (row.nameAr !== existing.nameAr || !moneyAmountsEqual(row.amount, existing.amount));
    if (!row.id || changed) {
      const createRes = await createCustomAllowance({
        companyId,
        employeeId,
        nameAr: row.nameAr,
        amount: roundMoney2(row.amount),
      });
      throwIfApiFailed(createRes, t('saveFailed'));
    }
  }

  queryClient.invalidateQueries({ queryKey: hrKeys.customAllowancesByCompany(companyId) });
  queryClient.invalidateQueries({ queryKey: employeeKeys.byCompany(companyId) });
  queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
}
