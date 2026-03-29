/**
 * AdvanceQuickModal — صرف سلفة سريع لموظف
 * يدعم employee محدد أو اختيار موظف من القائمة (employee=null)
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useVaults } from '../../../hooks/useVaults';
import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '../../../services/api';
import { getSaudiToday } from '../../../utils/saudiDate';

export function AdvanceQuickModal({ employee: initialEmployee, companyId, createAdvance, onSuccess, onClose }) {
  const { t } = useTranslation();
  const { paymentVaults = [] } = useVaults({ companyId });
  const vaults = paymentVaults;
  const [employee, setEmployee] = useState(initialEmployee);
  const [employeeId, setEmployeeId] = useState(initialEmployee?.id || '');
  const [amount, setAmount] = useState('');
  const [vaultId, setVaultId] = useState(vaults[0]?.id || '');
  const [txDate, setTxDate] = useState(getSaudiToday());
  const [notes, setNotes] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId, false],
    queryFn: async () => {
      const res = await getEmployees(companyId, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId && !initialEmployee,
  });

  const activeEmployees = (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');

  useEffect(() => {
    setVaultId(vaults[0]?.id || '');
  }, [vaults]);

  useEffect(() => {
    if (initialEmployee) {
      setEmployee(initialEmployee);
      setEmployeeId(initialEmployee.id);
    }
  }, [initialEmployee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const empId = initialEmployee ? initialEmployee.id : employeeId;
    const selectedEmp = initialEmployee ?? activeEmployees.find((em) => em.id === empId);
    const empName = selectedEmp?.name || selectedEmp?.nameAr || '';
    if (!amt || amt <= 0 || !vaultId || !empId) return;
    try {
      await createAdvance.mutateAsync({
        employeeId: empId,
        companyId,
        vaultId,
        amount: amt,
        transactionDate: txDate,
        notes: notes.trim() || `سلفة — ${empName}`,
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
    }
  };

  const title = initialEmployee
    ? t('advanceForEmployee', initialEmployee?.name || initialEmployee?.nameAr || '')
    : (t('payAdvance') || 'صرف سلفة');

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div className="noorix-surface-card" style={{ padding: 24, maxWidth: 400, width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{title}</h3>
        <form onSubmit={handleSubmit}>
          {!initialEmployee && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('selectEmployee')}</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              >
                <option value="">—</option>
                {activeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name || emp.nameAr || '—'}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('advanceAmount')}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('selectVault')}</label>
            <select
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            >
              {vaults.map((v) => (
                <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('transactionDate')}</label>
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('notes')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes')}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="noorix-btn-nav" style={{ background: 'var(--btn-primary-bg)', color: '#fff' }} disabled={createAdvance.isPending}>
              {createAdvance.isPending ? t('saving') : t('payAdvance')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
