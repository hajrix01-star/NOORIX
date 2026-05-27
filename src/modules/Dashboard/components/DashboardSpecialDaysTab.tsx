/**
 * DashboardSpecialDaysTab — إدارة الأيام الخاصة (رمضان، أعياد، إجازات)
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useDashboardCalendarData } from '../../../hooks/useDashboardCalendarData';
import { Button, Input } from '../../../ui';
import { toYmd } from '../../../utils/saudiDate';
import { getSaudiNow } from '../../../utils/saudiDate';
import { DashboardSaudiOccasionsImportModal } from './DashboardSaudiOccasionsImportModal';

const DEFAULT_COLORS = ['var(--color-noorix-amber)', '#eab308', '#84cc16', 'var(--noorix-accent-green)', '#8b5cf6'];

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function DashboardSpecialDaysTab({ companyId, year, selectedMonth }: {
  companyId: string;
  year: number;
  selectedMonth: number | null;
}) {
  const { t } = useTranslation();
  const saudiNow = getSaudiNow();
  const month = selectedMonth ?? saudiNow.month;
  const lastDay = lastDayOfMonth(year, month);
  const startDate = ymd(year, month, 1);
  const endDate = ymd(year, month, lastDay);

  const { specialDays: specialDaysList, saveSpecialDays } = useDashboardCalendarData({
    companyId,
    year,
    month,
    enabled: !!companyId,
  });

  const [showForm, setShowForm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newFrom, setNewFrom] = useState(startDate);
  const [newTo, setNewTo] = useState(endDate);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = useCallback(async () => {
    let from = toYmd(newFrom);
    let to = toYmd(newTo) || from;
    const name = (newName || t('dashboardSpecialDay')).trim();
    if (!from) return;
    if (to < from) {
      const tmp = from;
      from = to;
      to = tmp;
    }
    const id = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color = DEFAULT_COLORS[specialDaysList.length % DEFAULT_COLORS.length];
    const newList = [...specialDaysList, { id, name, fromDate: from, toDate: to, color }];
    try {
      await saveSpecialDays(newList);
      setNewFrom(startDate);
      setNewTo(endDate);
      setNewName('');
      setShowForm(false);
    } catch {
      // no-op
    }
  }, [newFrom, newTo, newName, startDate, endDate, t, specialDaysList, saveSpecialDays]);

  const handleUpdate = useCallback(
    async (id: string, updates: Record<string, unknown>) => {
      const newList = specialDaysList.map((x) => (x.id === id ? { ...x, ...updates } : x));
      try {
        await saveSpecialDays(newList);
        setEditingId(null);
      } catch {
        // no-op
      }
    },
    [specialDaysList, saveSpecialDays],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      if (!window.confirm(t('confirmDelete'))) return;
      try {
        await saveSpecialDays(specialDaysList.filter((x) => x.id !== id));
      } catch {
        // no-op
      }
    },
    [specialDaysList, saveSpecialDays, t],
  );

  const monthLabel = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];

  if (!companyId) {
    return (
      <div className="noorix-surface-card p-6 text-center text-noorix-muted">
        {t('pleaseSelectCompany')}
      </div>
    );
  }

  return (
    <div className="max-w-[560px]">
      <div className="mb-5">
        <h3 className="m-0 text-[16px] font-bold">
          {t('dashboardSpecialDays')} — {monthLabel} {year}
        </h3>
        <p className="mt-1.5 text-[13px] text-noorix-muted">{t('dashboardSpecialDaysDesc')}</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => setImportOpen(true)}>
          {t('dashboardImportSaudiOccasions')}
        </Button>
        {!showForm && (
          <Button size="sm" onClick={() => { setShowForm(true); setNewFrom(startDate); setNewTo(endDate); }}>
            + {t('add')}
          </Button>
        )}
      </div>

      <DashboardSaudiOccasionsImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        companyId={companyId}
        year={year}
      />

      {showForm && (
        <div className="p-5 mb-5 bg-noorix-bg-muted border border-noorix-border rounded-lg">
          <div className="font-bold mb-3">{t('dashboardSpecialDaysFromTo')}</div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 items-start">
              <div className="flex-1 min-w-[140px]">
                <Input type="date" label={t('dateFilterFrom')} value={newFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFrom(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Input type="date" label={t('dateFilterTo')} value={newTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTo(e.target.value)} />
              </div>
            </div>
            <Input
              label={t('dashboardSpecialDayName')}
              value={newName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
              placeholder={t('dashboardSpecialDayName')}
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void handleAdd()}>{t('save')}</Button>
              <Button
                onClick={() => {
                  setShowForm(false);
                  setNewFrom(startDate);
                  setNewTo(endDate);
                  setNewName('');
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {specialDaysList.map((sp) => (
          <div key={sp.id} className="noorix-surface-card flex items-center gap-3 p-3.5">
            <div className="w-3 h-3 rounded-md shrink-0" style={{ background: sp.color || '#8b5cf6' }} />
            {editingId === sp.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      void handleUpdate(sp.id, { name: editingName.trim() || sp.name });
                    }
                  }}
                  autoFocus
                  className="flex-1 min-w-0"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    void handleUpdate(sp.id, { name: editingName.trim() || sp.name });
                    setEditingId(null);
                  }}
                >
                  ✓
                </Button>
              </>
            ) : (
              <>
                <span
                  className="flex-1 min-w-0 text-[14px] font-semibold cursor-pointer truncate"
                  onClick={() => {
                    setEditingId(sp.id);
                    setEditingName(sp.name || '');
                  }}
                  title={t('edit')}
                >
                  {sp.name || '—'}
                </span>
                <span className="text-[12px] text-noorix-muted shrink-0 ltr" dir="ltr">
                  {sp.fromDate} — {sp.toDate}
                </span>
                <Button variant="danger" size="sm" onClick={() => void handleRemove(sp.id)}>
                  ✕
                </Button>
              </>
            )}
          </div>
        ))}
        {specialDaysList.length === 0 && !showForm && (
          <div className="text-center text-noorix-muted text-[13px] p-8 rounded-[10px] border border-dashed border-noorix-border">
            {t('dashboardNoSpecialDays')}
          </div>
        )}
      </div>
    </div>
  );
}
