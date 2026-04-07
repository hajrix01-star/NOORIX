/**
 * DashboardSpecialDaysTab — إدارة الأيام الخاصة (رمضان، أعياد، إجازات)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getStoredSpecialDays, setStoredSpecialDays } from '../utils/dashboardStorage';
import { Button, Input } from '../../../ui';

const DEFAULT_COLORS = ['var(--color-noorix-amber)', '#eab308', '#84cc16', 'var(--noorix-accent-green)', '#8b5cf6'];

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function DashboardSpecialDaysTab({ companyId, year, selectedMonth }) {
  const { t } = useTranslation();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const month = selectedMonth || currentMonth;
  const lastDay = lastDayOfMonth(year, month);
  const startDate = ymd(year, month, 1);
  const endDate = ymd(year, month, lastDay);

  const [specialDaysVersion, setSpecialDaysVersion] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [newFrom, setNewFrom] = useState(startDate);
  const [newTo, setNewTo] = useState(endDate);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const specialDaysList = useMemo(() => getStoredSpecialDays(companyId, year, month), [companyId, year, month, specialDaysVersion]);

  const handleAdd = useCallback(() => {
    let from = newFrom?.trim().slice(0, 10);
    let to = newTo?.trim().slice(0, 10) || from;
    const name = (newName || t('dashboardSpecialDay')).trim();
    if (!from) return;
    if (to < from) { const tmp = from; from = to; to = tmp; }
    const list = getStoredSpecialDays(companyId, year, month);
    const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color = DEFAULT_COLORS[list.length % DEFAULT_COLORS.length];
    list.push({ id, name, fromDate: from, toDate: to, color });
    setStoredSpecialDays(companyId, year, month, list);
    setSpecialDaysVersion((v) => v + 1);
    setNewFrom(startDate);
    setNewTo(endDate);
    setNewName('');
    setShowForm(false);
  }, [companyId, year, month, newFrom, newTo, newName, startDate, endDate, t]);

  const handleUpdate = useCallback((id, updates) => {
    const list = getStoredSpecialDays(companyId, year, month);
    const idx = list.findIndex((x) => x.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates };
      setStoredSpecialDays(companyId, year, month, list);
      setSpecialDaysVersion((v) => v + 1);
      setEditingId(null);
    }
  }, [companyId, year, month]);

  const handleRemove = useCallback((id) => {
    if (!window.confirm(t('confirmDelete'))) return;
    const list = getStoredSpecialDays(companyId, year, month).filter((x) => x.id !== id);
    setStoredSpecialDays(companyId, year, month, list);
    setSpecialDaysVersion((v) => v + 1);
  }, [companyId, year, month, t]);

  const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1];

  if (!companyId) {
    return (
      <div className="noorix-surface-card p-6 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="mb-5">
        <h3 className="m-0 text-[16px] font-bold">{t('dashboardSpecialDays')} — {monthLabel} {year}</h3>
        <p className="mt-1.5 text-[13px] text-noorix-muted">{t('dashboardSpecialDaysDesc')}</p>
      </div>

      {showForm && (
        <div className="p-5 mb-5 bg-noorix-bg-muted border border-noorix-border rounded-lg">
          <div className="font-bold mb-3">{t('dashboardSpecialDaysFromTo')}</div>
          <div className="flex flex flex-col gap-3">
            <div className="flex flex flex-wrap gap-3" style={{ alignItems: 'flex-start' }}>
              <div className="flex-1 min-w-0" style={{ minWidth: 140 }}>
                <Input type="date" label={t('dateFilterFrom')} value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
              </div>
              <div className="flex-1 min-w-0" style={{ minWidth: 140 }}>
                <Input type="date" label={t('dateFilterTo')} value={newTo} onChange={(e) => setNewTo(e.target.value)} />
              </div>
            </div>
            <Input
              label={t('dashboardSpecialDayName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('dashboardSpecialDayName')}
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleAdd}>{t('save')}</Button>
              <Button onClick={() => { setShowForm(false); setNewFrom(startDate); setNewTo(endDate); setNewName(''); }}>{t('cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="primary" className="mb-3" onClick={() => { setShowForm(true); setNewFrom(startDate); setNewTo(endDate); }}>
          + {t('add')}
        </Button>
      )}

      <div className="flex flex flex-col gap-2.5">
        {specialDaysList.map((sp) => (
          <div key={sp.id} className="flex items-center gap-12 p-3.5 bg-noorix-surface border border-noorix-border rounded-lg">
            <div style={{ width: 12, height: 12, borderRadius: 6, background: sp.color || '#8b5cf6', flexShrink: 0 }} />
            {editingId === sp.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate(sp.id, { name: editingName.trim() || sp.name }); } }}
                  autoFocus
                  className="flex-1 min-w-0"
                />
                <Button variant="primary" onClick={() => { handleUpdate(sp.id, { name: editingName.trim() || sp.name }); setEditingId(null); }}>✓</Button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 text-[14px] font-semibold cursor-pointer" onClick={() => { setEditingId(sp.id); setEditingName(sp.name || ''); }} title={t('edit')}>{sp.name || '—'}</span>
                <span className="text-[12px] text-noorix-muted">{sp.fromDate} — {sp.toDate}</span>
                <Button variant="danger" onClick={() => handleRemove(sp.id)}>✕</Button>
              </>
            )}
          </div>
        ))}
        {specialDaysList.length === 0 && !showForm && (
          <div className="text-center text-noorix-muted text-[13px]" style={{ padding: 32, border: '1px dashed var(--noorix-border)', borderRadius: 10 }}>
            {t('dashboardNoSpecialDays')}
          </div>
        )}
      </div>
    </div>
  );
}
