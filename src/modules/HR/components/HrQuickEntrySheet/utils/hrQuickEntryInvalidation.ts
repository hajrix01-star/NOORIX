import type { QueryClient } from '@tanstack/react-query';
import { employeeKeys, hrKeys } from '../../../../../services/queryKeys';

export function invalidateHrQueries(qc: QueryClient, companyId: string) {
  qc.invalidateQueries({ queryKey: employeeKeys.byCompany(companyId) });
  qc.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
  qc.invalidateQueries({ queryKey: hrKeys.leaves(companyId) });
  qc.invalidateQueries({ queryKey: hrKeys.deductionsByCompany(companyId) });
  qc.invalidateQueries({ queryKey: hrKeys.customAllowancesByCompany(companyId) });
  qc.invalidateQueries({ queryKey: hrKeys.movementsCompany(companyId) });
}
