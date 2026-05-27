/**
 * استيراد مناسبات سعودية (أعياد، رمضان، إجازات وطنية) وتطبيقها على التقويم.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import {
  applyDashboardSpecialOccasions,
  getDashboardSaudiOccasions,
  type SaudiOccasionDto,
} from '../../../services/domains/apiEndpoints/dashboard-calendar';
import { dashboardKeys } from '../../../services/queryKeys/dashboard';
import { unwrapApiDataOr } from '../../../services/core/apiHttp';
import { Button, Modal, Spinner } from '../../../ui';
import { cn } from '../../../ui/cn';
import { shiftYmd } from '../../../utils/shiftYmd';

type Step = 'pick' | 'scope';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  year: number;
  onApplied?: () => void;
};

export function DashboardSaudiOccasionsImportModal({
  open,
  onClose,
  companyId,
  year,
  onApplied,
}: Props) {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('pick');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dayShifts, setDayShifts] = useState<Record<string, number>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const occasionsQuery = useQuery({
    queryKey: ['dashboard-saudi-occasions', year],
    queryFn: async () => {
      const res = await getDashboardSaudiOccasions(year);
      return unwrapApiDataOr(res, [] as SaudiOccasionDto[]);
    },
    enabled: open && !!year,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const occasions = occasionsQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      setStep('pick');
      setSelected(new Set());
      setDayShifts({});
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && occasions.length > 0) {
      setSelected(new Set(occasions.map((o) => o.id)));
    }
  }, [open, occasions]);

  const labelFor = useCallback(
    (o: SaudiOccasionDto) => (lang === 'ar' ? o.nameAr : o.nameEn),
    [lang],
  );

  const getShift = (id: string) => dayShifts[id] ?? 0;

  const dateRangeLabel = useCallback(
    (o: SaudiOccasionDto) => {
      const shift = dayShifts[o.id] ?? 0;
      const from = shiftYmd(o.fromDate, shift);
      const to = shiftYmd(o.toDate, shift);
      return from === to ? from : `${from} — ${to}`;
    },
    [dayShifts],
  );

  const setShift = (id: string, value: number) => {
    const clamped = Math.max(-3, Math.min(3, value));
    setDayShifts((prev) => {
      if (!clamped) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: clamped };
    });
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(occasions.map((o) => o.id)));
  const clearAll = () => setSelected(new Set());

  const companyCount = companies.length;
  const canApplyTenant = companyCount > 1;

  const runApply = async (scope: 'company' | 'tenant') => {
    if (!selected.size) {
      setError(t('dashboardImportSaudiNoSelection'));
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const shiftsPayload: Record<string, number> = {};
      for (const id of selected) {
        const s = getShift(id);
        if (s) shiftsPayload[id] = s;
      }
      const res = await applyDashboardSpecialOccasions(companyId, {
        year,
        occasionIds: [...selected],
        scope,
        lang: lang === 'en' ? 'en' : 'ar',
        companyIds: scope === 'tenant' ? companies.map((c) => c.id) : undefined,
        dayShifts: Object.keys(shiftsPayload).length ? shiftsPayload : undefined,
      });
      const data = unwrapApiDataOr(res, { companies: 0, monthsUpdated: 0, occasionCount: 0 });
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.calendarRoot() });
      onApplied?.();
      window.alert(
        t('dashboardImportSaudiSuccess', {
          0: String(data.occasionCount || selected.size),
          1: String(data.companies || 1),
        }),
      );
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('importErrorUnknown'));
    } finally {
      setApplying(false);
    }
  };

  const onApplyClick = () => {
    if (!selected.size) {
      setError(t('dashboardImportSaudiNoSelection'));
      return;
    }
    if (canApplyTenant) {
      setStep('scope');
      return;
    }
    void runApply('company');
  };

  const title =
    step === 'scope' ? t('dashboardImportSaudiScopeTitle') : t('dashboardImportSaudiOccasions');

  const footer = useMemo(() => {
    if (step === 'scope') {
      return (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button size="sm" variant="ghost" onClick={() => setStep('pick')} disabled={applying}>
            {t('dashboardBack')}
          </Button>
          <Button size="sm" onClick={() => void runApply('company')} disabled={applying}>
            {t('dashboardImportSaudiScopeCompany')}
          </Button>
          <Button size="sm" variant="primary" onClick={() => void runApply('tenant')} disabled={applying}>
            {t('dashboardImportSaudiScopeTenant')}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={selectAll} disabled={!occasions.length || applying}>
            {t('dashboardImportSaudiSelectAll')}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearAll} disabled={!selected.size || applying}>
            {t('dashboardImportSaudiClear')}
          </Button>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={applying}>
            {t('cancel')}
          </Button>
          <Button size="sm" variant="primary" onClick={onApplyClick} disabled={applying || occasionsQuery.isLoading}>
            {applying ? t('loading') : t('dashboardImportSaudiApply')}
          </Button>
        </div>
      </div>
    );
  }, [step, applying, occasions.length, selected.size, occasionsQuery.isLoading, t, onClose, onApplyClick]);

  return (
    <Modal open={open} onClose={onClose} title={title} size="md" footer={footer}>
      {step === 'scope' ? (
        <div className="flex flex-col gap-3 text-[13px] text-noorix-text">
          <p className="m-0 text-noorix-muted">
            {t('dashboardImportSaudiScopeTenantCount', { 0: String(companyCount) })}
          </p>
          <ul className="m-0 list-disc ps-5 text-noorix-muted">
            {[...selected].map((id) => {
              const o = occasions.find((x) => x.id === id);
              if (!o) return null;
              const shift = getShift(id);
              const dates = dateRangeLabel(o);
              return (
                <li key={id}>
                  {labelFor(o)}
                  {shift !== 0 ? ` (${dates})` : ''}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[12px] text-noorix-muted">{t('dashboardImportSaudiOccasionsHint')}</p>
          <p className="m-0 text-[11px] text-noorix-muted">{t('dashboardImportSaudiShiftHint')}</p>
          {error && (
            <p className="m-0 text-[12px] font-medium text-noorix-red" role="alert">
              {error}
            </p>
          )}
          {occasionsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
              <span className="sr-only">{t('dashboardImportSaudiLoading')}</span>
            </div>
          ) : occasions.length === 0 ? (
            <p className="text-center text-[13px] text-noorix-muted py-6">{t('dashboardImportSaudiEmptyYear')}</p>
          ) : (
            <ul className="m-0 flex flex-col gap-2 max-h-[min(52vh,360px)] overflow-y-auto">
              {occasions.map((o) => {
                const checked = selected.has(o.id);
                const shift = getShift(o.id);
                return (
                  <li key={o.id}>
                    <div
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        checked
                          ? 'border-noorix-blue bg-[color-mix(in_srgb,var(--color-nx-sales)_8%,transparent)]'
                          : 'border-noorix-border bg-noorix-surface',
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0"
                          checked={checked}
                          onChange={() => toggle(o.id)}
                        />
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                          style={{ background: o.color }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-noorix-text">{labelFor(o)}</span>
                            <span
                              className={cn(
                                'rounded px-1.5 py-px text-[9px] font-semibold',
                                o.estimated
                                  ? 'bg-[color-mix(in_srgb,var(--color-nx-net-profit)_18%,transparent)] text-[var(--color-nx-net-profit)]'
                                  : 'bg-[color-mix(in_srgb,var(--color-nx-sales)_12%,transparent)] text-noorix-blue',
                              )}
                            >
                              {o.estimated ? t('dashboardImportSaudiEstimated') : t('dashboardImportSaudiOfficial')}
                            </span>
                          </span>
                          <span className="block text-[11px] text-noorix-muted ltr" dir="ltr">
                            {dateRangeLabel(o)}
                            {shift !== 0 && (
                              <span className="ms-1 text-noorix-blue">
                                ({shift > 0 ? '+' : ''}
                                {shift})
                              </span>
                            )}
                          </span>
                        </span>
                      </label>
                      {checked && o.estimated && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 ps-7">
                          <Button
                            type="button"
                            size="sm"
                            variant={shift === -1 ? 'primary' : 'ghost'}
                            onClick={() => setShift(o.id, -1)}
                            disabled={applying}
                          >
                            {t('dashboardImportSaudiShiftAdvance')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={shift === 0 ? 'primary' : 'ghost'}
                            onClick={() => setShift(o.id, 0)}
                            disabled={applying}
                          >
                            {t('dashboardImportSaudiShiftReset')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={shift === 1 ? 'primary' : 'ghost'}
                            onClick={() => setShift(o.id, 1)}
                            disabled={applying}
                          >
                            {t('dashboardImportSaudiShiftDelay')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
