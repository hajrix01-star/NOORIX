/**
 * DashboardSpecialDaysTab — إدارة الأيام الخاصة (رمضان، أعياد، إجازات)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { getStoredSpecialDays, setStoredSpecialDays } from '../utils/dashboardStorage';

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
  const currentYear = now.getFullYear();
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
    const from = newFrom?.trim().slice(0, 10);
    const to = newTo?.trim().slice(0, 10) || from;
    const name = (newName || t('dashboardSpecialDay')).trim();
    if (!from) return;
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
    const list = getStoredSpecialDays(companyId, year, month).filter((x) => x.id !== id);
    setStoredSpecialDays(companyId, year, month, list);
    setSpecialDaysVersion((v) => v + 1);
  }, [companyId, year, month]);

  const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1];

  if (!companyId) {
    return (
      <div className="noorix-surface-card" style={{ padding: 24, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📅 {t('dashboardSpecialDays')} — {monthLabel} {year}</h3>
        <p style={{ marginTop: 6, fontSize: 13, color: 'var(--noorix-text-muted)' }}>{t('dashboardSpecialDaysDesc')}</p>
      </div>

      {showForm && (
        <div style={{ padding: 20, marginBottom: 20, background: 'var(--noorix-bg-muted)', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{t('dashboardSpecialDaysFromTo')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--noorix-text-muted)' }}>{t('dateFilterFrom')}</label>
                <input type="date" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)', fontSize: 13 }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--noorix-text-muted)' }}>{t('dateFilterTo')}</label>
                <input type="date" value={newTo} onChange={(e) => setNewTo(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)', fontSize: 13 }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 4, color: 'var(--noorix-text-muted)' }}>{t('dashboardSpecialDayName')}</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('dashboardSpecialDayName')} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--noorix-border)', fontSize: 13 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={handleAdd} style={{ padding: '8px 16px', fontSize: 12 }}>{t('save')}</button>
              <button type="button" className="noorix-btn-nav" onClick={() => { setShowForm(false); setNewFrom(startDate); setNewTo(endDate); setNewName(''); }} style={{ padding: '8px 16px', fontSize: 12 }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {!showForm && (
        <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => { setShowForm(true); setNewFrom(startDate); setNewTo(endDate); }} style={{ marginBottom: 12, padding: '8px 14px', fontSize: 12 }}>+ {t('add')}</button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {specialDaysList.map((sp) => (
          <div key={sp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)', borderRadius: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: sp.color || '#8b5cf6', flexShrink: 0 }} />
            {editingId === sp.id ? (
              <>
                <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdate(sp.id, { name: editingName.trim() || sp.name }); } }} autoFocus style={{ flex: 1, padding: '8px 10px', fontSize: 13, border: '1px solid var(--noorix-border)', borderRadius: 8 }} />
                <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => { handleUpdate(sp.id, { name: editingName.trim() || sp.name }); setEditingId(null); }} style={{ padding: '6px 12px', fontSize: 11 }}>✓</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setEditingId(sp.id); setEditingName(sp.name || ''); }} title={t('edit')}>{sp.name || '—'}</span>
                <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{sp.fromDate} — {sp.toDate}</span>
                <button type="button" className="noorix-btn-nav" onClick={() => handleRemove(sp.id)} style={{ padding: '6px 10px', fontSize: 11, color: '#dc2626' }}>✕</button>
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
