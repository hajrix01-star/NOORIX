/**
 * DashboardSpecialDaysTab — إدارة الأيام الخاصة (رمضان، أعياد، إجازات)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getStoredSpecialDays, setStoredSpecialDays } from '../utils/dashboardStorage';
import { Button, Input } from '../../../ui';

const DEFAULT_COLORS = ['#f59e0b', '#eab308', '#84cc16', '#22c55e', '#8b5cf6'];

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
      <div className="noorix-surface-card nx-p-24 nx-text-center nx-text-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 className="nx-m-0 nx-text-xl nx-font-700">{t('dashboardSpecialDays')} — {monthLabel} {year}</h3>
        <p className="nx-mt-6 nx-text-base nx-text-muted">{t('dashboardSpecialDaysDesc')}</p>
      </div>

      {showForm && (
        <div style={{ padding: 20, marginBottom: 20, background: 'var(--noorix-bg-muted)', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('dashboardSpecialDaysFromTo')}</div>
          <div className="nx-flex nx-flex-col nx-gap-12">
            <div className="nx-flex nx-flex-wrap nx-gap-12" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <Input type="date" label={t('dateFilterFrom')} value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <Input type="date" label={t('dateFilterTo')} value={newTo} onChange={(e) => setNewTo(e.target.value)} />
              </div>
            </div>
            <Input
              label={t('dashboardSpecialDayName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('dashboardSpecialDayName')}
            />
            <div className="nx-flex nx-gap-8">
              <Button variant="primary" onClick={handleAdd}>{t('save')}</Button>
              <Button onClick={() => { setShowForm(false); setNewFrom(startDate); setNewTo(endDate); setNewName(''); }}>{t('cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="primary" onClick={() => { setShowForm(true); setNewFrom(startDate); setNewTo(endDate); }} style={{ marginBottom: 12 }}>
          + {t('add')}
        </Button>
      )}

      <div className="nx-flex nx-flex-col nx-gap-10">
        {specialDaysList.map((sp) => (
          <div key={sp.id} className="nx-flex nx-gap-12 nx-p-14 nx-bg-surface nx-border-all nx-rounded" style={{ alignItems: 'center' }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: sp.color || '#8b5cf6', flexShrink: 0 }} />
            {editingId === sp.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate(sp.id, { name: editingName.trim() || sp.name }); } }}
                  autoFocus
                  style={{ flex: 1 }}
                />
                <Button variant="primary" onClick={() => { handleUpdate(sp.id, { name: editingName.trim() || sp.name }); setEditingId(null); }}>✓</Button>
              </>
            ) : (
              <>
                <span className="nx-flex-1 nx-text-md nx-font-600 nx-cursor-pointer" onClick={() => { setEditingId(sp.id); setEditingName(sp.name || ''); }} title={t('edit')}>{sp.name || '—'}</span>
                <span className="nx-text-sm nx-text-muted">{sp.fromDate} — {sp.toDate}</span>
                <Button variant="danger" onClick={() => handleRemove(sp.id)}>✕</Button>
              </>
            )}
          </div>
        ))}
        {specialDaysList.length === 0 && !showForm && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)', fontSize: 13, border: '1px dashed var(--noorix-border)', borderRadius: 10 }}>
            {t('dashboardNoSpecialDays')}
          </div>
        )}
      </div>
    </div>
  );
}
