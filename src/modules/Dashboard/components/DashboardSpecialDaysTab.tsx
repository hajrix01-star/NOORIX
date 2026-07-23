/**
 * DashboardSpecialDaysTab — إدارة الأيام الخاصة (رمضان، أعياد، إجازات)
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { useToast } from '../../../context/ToastContext';
import { useDashboardYearSpecialDays } from '../../../hooks/useDashboardYearSpecialDays';
import { Button, ColorSwatch, DateRangeField, DialogActions, Input, Modal } from '../../../ui';
import { toYmd } from '../../../utils/saudiDate';
import { getSaudiNow, getSaudiToday } from '../../../utils/saudiDate';
import { DashboardCalendarOccasionCenter } from './DashboardCalendarOccasionCenter';
import type { DashboardSpecialDay } from '../../../types/api/domains/dashboard';
import { createDashboardSpecialDayId } from '../utils/dashboardSpecialDayId';
import {
  dashboardLastDayOfMonth,
  dashboardMonthFromYmd,
  dashboardYmd,
  splitDashboardSpecialDayByMonth,
} from '../utils/dashboardSpecialDaysModel';

const DEFAULT_COLORS = ['var(--color-noorix-amber)', '#eab308', '#84cc16', 'var(--noorix-accent-green)', '#8b5cf6'];

type SpecialDayStatus = 'current' | 'upcoming' | 'ended';

const SPECIAL_DAY_STATUS_ORDER: SpecialDayStatus[] = ['current', 'upcoming', 'ended'];

const SPECIAL_DAY_STATUS_LABELS: Record<SpecialDayStatus, string> = {
  current: 'حالية',
  upcoming: 'قادمة',
  ended: 'منتهية',
};

const SPECIAL_DAY_EMPTY_LABELS: Record<SpecialDayStatus, string> = {
  current: 'لا توجد أيام خاصة حالية.',
  upcoming: 'لا توجد أيام خاصة قادمة.',
  ended: 'لا توجد أيام خاصة منتهية.',
};

function getSpecialDayStatus(day: DashboardSpecialDay, today: string): SpecialDayStatus {
  const fromDate = toYmd(day.fromDate);
  const toDate = toYmd(day.toDate) || fromDate;
  if (fromDate <= today && today <= toDate) return 'current';
  if (fromDate > today) return 'upcoming';
  return 'ended';
}

function sortSpecialDaysByStatus(status: SpecialDayStatus, days: DashboardSpecialDay[]): DashboardSpecialDay[] {
  return [...days].sort((a, b) => {
    const aDate = toYmd(a.fromDate);
    const bDate = toYmd(b.fromDate);
    return status === 'ended' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
  });
}

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
  const [newFrom, setNewFrom] = useState(startDate);
  const [newTo, setNewTo] = useState(endDate);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<DashboardSpecialDay | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSpecialDayStatus, setActiveSpecialDayStatus] = useState<SpecialDayStatus>('current');
  const todayYmd = getSaudiToday();

  const groupedSpecialDays = useMemo(() => {
    const grouped: Record<SpecialDayStatus, DashboardSpecialDay[]> = {
      current: [],
      upcoming: [],
      ended: [],
    };

    for (const specialDay of specialDaysList) {
      grouped[getSpecialDayStatus(specialDay, todayYmd)].push(specialDay);
    }

    return {
      current: sortSpecialDaysByStatus('current', grouped.current),
      upcoming: sortSpecialDaysByStatus('upcoming', grouped.upcoming),
      ended: sortSpecialDaysByStatus('ended', grouped.ended),
    };
  }, [specialDaysList, todayYmd]);

  const activeSpecialDays = groupedSpecialDays[activeSpecialDayStatus];

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

      <DashboardCalendarOccasionCenter
        companyId={companyId}
        year={year}
        onApplied={() => void invalidateYear()}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {!showForm && (
          <Button size="sm" onClick={() => { setShowForm(true); setNewFrom(startDate); setNewTo(endDate); }}>
            + {t('add')}
          </Button>
        )}
      </div>

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

      <div className="flex flex-col gap-3">
        {yearSpecialDaysLoading && specialDaysList.length === 0 && (
          <p className="text-center text-[13px] text-noorix-muted py-4">{t('loading')}</p>
        )}
        {(!yearSpecialDaysLoading || specialDaysList.length > 0) && (
          <section className="noorix-surface-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-noorix-border bg-noorix-bg-muted p-2">
              {SPECIAL_DAY_STATUS_ORDER.map((status) => {
                const isActive = activeSpecialDayStatus === status;
                return (
                  <Button
                    key={status}
                    size="sm"
                    variant={isActive ? 'primary' : 'secondary'}
                    onClick={() => setActiveSpecialDayStatus(status)}
                  >
                    {SPECIAL_DAY_STATUS_LABELS[status]} ({groupedSpecialDays[status].length})
                  </Button>
                );
              })}
            </div>
            <div className="flex flex-col divide-y divide-noorix-border">
              {activeSpecialDays.length === 0 ? (
                <p className="m-0 px-3.5 py-6 text-center text-[12px] text-noorix-muted">
                  {SPECIAL_DAY_EMPTY_LABELS[activeSpecialDayStatus]}
                </p>
              ) : (
                activeSpecialDays.map((sp) => (
                  <div key={`${sp.id}-${sp.fromDate}-${sp.toDate}`} className="flex items-center gap-3 p-3.5">
                    <ColorSwatch className="h-3 w-3 shrink-0 rounded-md" color={sp.color} fallbackColor="#8b5cf6" />
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
                          className="min-w-0 flex-1"
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
                          className="min-w-0 flex-1 cursor-pointer truncate text-[14px] font-semibold"
                          onClick={() => {
                            setEditingId(sp.id);
                            setEditingName(sp.name || '');
                          }}
                          title={t('edit')}
                        >
                          {sp.name || '—'}
                        </span>
                        <span className="shrink-0 text-[12px] text-noorix-muted ltr" dir="ltr">
                          {sp.fromDate} — {sp.toDate}
                        </span>
                        <Button variant="danger" size="sm" onClick={() => setPendingDelete(sp)}>
                          ✕
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
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
