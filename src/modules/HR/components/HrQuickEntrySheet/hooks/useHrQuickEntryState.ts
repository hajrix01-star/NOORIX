import { useEffect, useRef, useState } from 'react';
import { getEmployees } from '../../../../../services/api';
import { useApiListQuery } from '../../../../../hooks/useApiQuery';
import { useVaults } from '../../../../../hooks/useVaults';
import { getSaudiToday } from '../../../../../utils/saudiDate';
import { employeeKeys } from '../../../../../services/queryKeys';
import type { HrQuickEntryMode } from '../types';

export function useHrQuickEntryState(mode: HrQuickEntryMode, companyId: string) {
  const { paymentVaults = [], isLoading: vaultsLoading } = useVaults({ companyId });
  const vaults = paymentVaults;

  const { data: employees = [], isLoading: employeesLoading } = useApiListQuery<any>({
    queryKey: employeeKeys.list(companyId, false),
    queryFn: () => getEmployees(companyId, false),
    fallbackMessage: 'فشل تحميل الموظفين',
    enabled: !!companyId,
  });

  const [advEmp, setAdvEmp] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advVault, setAdvVault] = useState('');
  const [advDate, setAdvDate] = useState(getSaudiToday());
  const [advNotes, setAdvNotes] = useState('');

  const [lvEmp, setLvEmp] = useState('');
  const [lvType, setLvType] = useState('annual');
  const [lvStart, setLvStart] = useState('');
  const [lvEnd, setLvEnd] = useState('');
  const [lvDays, setLvDays] = useState('');
  const [lvNotes, setLvNotes] = useState('');

  const [ddEmp, setDdEmp] = useState('');
  const [ddType, setDdType] = useState('penalty');
  const [ddAmount, setDdAmount] = useState('');
  const [ddDate, setDdDate] = useState(getSaudiToday());
  const [ddNotes, setDdNotes] = useState('');

  const [incTab, setIncTab] = useState('movement');
  const [mvEmp, setMvEmp] = useState('');
  const [mvType, setMvType] = useState('raise');
  const [mvAmount, setMvAmount] = useState('');
  const [mvPrev, setMvPrev] = useState('');
  const [mvNew, setMvNew] = useState('');
  const [mvEff, setMvEff] = useState(getSaudiToday());
  const [mvNotes, setMvNotes] = useState('');
  const [alEmp, setAlEmp] = useState('');
  const [alName, setAlName] = useState('');
  const [alAmount, setAlAmount] = useState('');

  const [formError, setFormError] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [pendingData, setPendingData] = useState<{
    payload: unknown;
    report: { textAr: string; textEn: string };
    mut: { mutate: (v: { payload: unknown; report: { textAr: string; textEn: string } }) => void };
  } | null>(null);

  useEffect(() => {
    setFormError('');
  }, [mode]);

  useEffect(() => {
    if (!confirmStep) setPendingData(null);
  }, [confirmStep]);

  useEffect(() => {
    if (!lvStart || !lvEnd) return;
    const s = new Date(lvStart);
    const e = new Date(lvEnd);
    if (e >= s) {
      const days = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
      setLvDays(String(days));
    }
  }, [lvStart, lvEnd]);

  const dataLoading = employeesLoading || (mode === 'advance' && vaultsLoading);

  return {
    vaults,
    vaultsLoading,
    employees,
    employeesLoading,
    advEmp,
    setAdvEmp,
    advAmount,
    setAdvAmount,
    advVault,
    setAdvVault,
    advDate,
    setAdvDate,
    advNotes,
    setAdvNotes,
    lvEmp,
    setLvEmp,
    lvType,
    setLvType,
    lvStart,
    setLvStart,
    lvEnd,
    setLvEnd,
    lvDays,
    setLvDays,
    lvNotes,
    setLvNotes,
    ddEmp,
    setDdEmp,
    ddType,
    setDdType,
    ddAmount,
    setDdAmount,
    ddDate,
    setDdDate,
    ddNotes,
    setDdNotes,
    incTab,
    setIncTab,
    mvEmp,
    setMvEmp,
    mvType,
    setMvType,
    mvAmount,
    setMvAmount,
    mvPrev,
    setMvPrev,
    mvNew,
    setMvNew,
    mvEff,
    setMvEff,
    mvNotes,
    setMvNotes,
    alEmp,
    setAlEmp,
    alName,
    setAlName,
    alAmount,
    setAlAmount,
    formError,
    setFormError,
    confirmStep,
    setConfirmStep,
    pendingData,
    setPendingData,
    dataLoading,
  };
}
