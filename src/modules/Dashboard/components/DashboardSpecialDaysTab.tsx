/**
 * DashboardSpecialDaysTab — إدارة الأيام الخاصة (رمضان، أعياد، إجازات)
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { useDashboardYearSpecialDays } from '../../../hooks/useDashboardYearSpecialDays';
import { Button, ColorSwatch, DateRangeField, DialogActions, Input, Modal } from '../../../ui';
import { toYmd } from '../../../utils/saudiDate';
import { getSaudiNow } from '../../../utils/saudiDate';
import { DashboardSaudiOccasionsImportModal } from './DashboardSaudiOccasionsImportModal';
import { DashboardSchoolHolidaysImportModal } from './DashboardSchoolHolidaysImportModal';
import type { DashboardSpecialDay } from '../../../types/api/domains/dashboard';
import { createDashboardSpecialDayId } from '../utils/dashboardSpecialDayId';
import {
  dashboardLastDayOfMonth,
  dashboardMonthFromYmd,
  dashboardYmd,
  splitDashboardSpecialDayByMonth,
} from '../utils/dashboardSpecialDaysModel';

const DEFAULT_COLORS = ['var(--color-noorix-amber)', '#eab308', '#84cc16', 'var(--noorix-accent-green)', '#8b5cf6'];

export default function DashboardSpecialDaysTab({ companyId, year, selectedMonth }: {
  companyId: string;
  year: number;
  selectedMonth: number | null;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const saudiNow = getSaudiNow();
  const month = selectedMonth ?? saudiNow.month;
  const lastDay = dashboardLastDayOfMonth(year, month);
  const startDate = dashboardYmd(year, month, 1);
  const endDate = dashboardYmd(year, month, lastDay);

  const {
    specialDays: specialDaysList,
    getMonthSpecialDays,
    saveMonthSpecialDays,
    updateSpecialDayById,
    removeSpecialDayById,
    invalidateYear,
    isLoading: yearSpecialDaysLoading,
  } = useDashboardYearSpecialDays({
    companyId,
    year,
    enabled: !!companyId,
  });

  const [showForm, setShowForm] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [schoolImportOpen, setSchoolImportOpen] = useState(false);
  const [newFrom, setNewFrom] = useState(startDate);
  const [newTo, setNewTo] = useState(endDate);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<DashboardSpecialDay | null>(null);
  const [saving, setSaving] = useState(false);

  const showSaveError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : t('saveFailedGeneric');
      showToast(message, 'error');
    },
    [showToast, t],
  );

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
    const id = createDashboardSpecialDayId();
    const color = DEFAULT_COLORS[specialDaysList.length % DEFAULT_COLORS.length];
    const segments = splitDashboardSpecialDayByMonth(id, name, color, from, to);
    try {
      setSaving(true);
      await Promise.all(
        segments.map((segment) => {
          const targetMonth = dashboardMonthFromYmd(segment.fromDate) ?? month;
          return saveMonthSpecialDays(targetMonth, [...getMonthSpecialDays(targetMonth), segment]);
        }),
      );
      await invalidateYear();
      setNewFrom(startDate);
      setNewTo(endDate);
      setNewName('');
      setShowForm(false);
      showToast(t('savedSuccessfully'), 'success');
    } catch (error) {
      showSaveError(error);
    } finally {
      setSaving(false);
    }
  }, [
    newFrom,
    newTo,
    newName,
    startDate,
    endDate,
    t,
    specialDaysList,
    getMonthSpecialDays,
    saveMonthSpecialDays,
    month,
    invalidateYear,
    showToast,
    showSaveError,
  ]);

  const handleUpdate = useCallback(
    async (id: string, updates: Partial<DashboardSpecialDay>) => {
      try {
        setSaving(true);
        await updateSpecialDayById(id, updates);
        setEditingId(null);
        showToast(t('savedSuccessfully'), 'success');
      } catch (error) {
        showSaveError(error);
      } finally {
        setSaving(false);
      }
    },
    [updateSpecialDayById, showToast, showSaveError, t],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        setSaving(true);
        await removeSpecialDayById(id);
        setPendingDelete(null);
        showToast(t('deletedSuccessfully'), 'success');
      } catch (error) {
        showSaveError(error);
      } finally {
        setSaving(false);
      }
    },
    [removeSpecialDayById, showToast, showSaveError, t],
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
          {t('dashboardSpecialDays')} — {year}
        </h3>
        <p className="mt-1.5 text-[13px] text-noorix-muted">{t('dashboardSpecialDaysYearDesc')}</p>
        <p className="mt-1 text-[11px] text-noorix-muted">
          {t('dashboardSpecialDaysAddMonthHint', { 0: `${monthLabel} ${year}` })}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => setImportOpen(true)}>
          {t('dashboardImportSaudiOccasions')}
        </Button>
        <Button size="sm" onClick={() => setSchoolImportOpen(true)}>
          {t('dashboardImportSchoolHolidays')}
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
        onApplied={() => void invalidateYear()}
      />

      <DashboardSchoolHolidaysImportModal
        open={schoolImportOpen}
        onClose={() => setSchoolImportOpen(false)}
        companyId={companyId}
        year={year}
        onApplied={() => void invalidateYear()}
      />

      {showForm && (
        <div className="p-5 mb-5 bg-noorix-bg-muted border border-noorix-border rounded-lg">
          <div className="font-bold mb-3">{t('dashboardSpecialDaysFromTo')}</div>
          <div className="flex flex-col gap-3">
            <DateRangeField
              className="flex flex-wrap gap-3 items-start"
              startContainerClassName="flex-1 min-w-[140px]"
              endContainerClassName="flex-1 min-w-[140px]"
              startLabel={t('dateFilterFrom')}
              endLabel={t('dateFilterTo')}
              startValue={newFrom}
              endValue={newTo}
              minEnd={newFrom}
              onStartChange={setNewFrom}
              onEndChange={setNewTo}
            />
            <Input
              label={t('dashboardSpecialDayName')}
              value={newName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
              placeholder={t('dashboardSpecialDayName')}
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void handleAdd()} disabled={saving}>{t('save')}</Button>
              <Button
                disabled={saving}
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
        {yearSpecialDaysLoading && specialDaysList.length === 0 && (
          <p className="text-center text-[13px] text-noorix-muted py-4">{t('loading')}</p>
        )}
        {specialDaysList.map((sp) => (
          <div key={`${sp.id}-${sp.fromDate}-${sp.toDate}`} className="noorix-surface-card flex items-center gap-3 p-3.5">
            <ColorSwatch className="w-3 h-3 rounded-md shrink-0" color={sp.color} fallbackColor="#8b5cf6" />
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
                  disabled={saving}
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
                <Button variant="danger" size="sm" onClick={() => setPendingDelete(sp)}>
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

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title={t('confirmDelete')}
        size="sm"
        footer={(
          <DialogActions
            size="sm"
            actions={[
              { key: 'cancel', label: t('cancel'), role: 'cancel', onClick: () => setPendingDelete(null) },
              {
                key: 'delete',
                label: t('delete'),
                role: 'delete',
                disabled: saving,
                onClick: () => {
                  if (pendingDelete) void handleRemove(pendingDelete.id);
                },
              },
            ]}
          />
        )}
      >
        <p className="m-0 text-[13px] text-noorix-muted">
          {pendingDelete?.name || t('dashboardSpecialDay')}
        </p>
      </Modal>
    </div>
  );
}
