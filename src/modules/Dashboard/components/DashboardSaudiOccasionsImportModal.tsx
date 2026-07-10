/**
 * استيراد مناسبات سعودية (أعياد، رمضان، إجازات وطنية) وتطبيقها على التقويم.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import {
  applyDashboardSpecialOccasions,
  type SaudiOccasionDto,
} from '../../../services/domains/apiEndpoints/dashboard-calendar';
import { dashboardKeys } from '../../../services/queryKeys/dashboard';
import { unwrapApiDataOr } from '../../../services/core/apiHttp';
import {
  applySaudiOccasionsViaCalendar,
  fetchSaudiOccasionsCatalog,
  isSaudiOccasionsApiMissing,
} from '../../../utils/saudiOccasionsApply';
import { Button, Checkbox, ColorSwatch, DialogActions, Modal, Spinner } from '../../../ui';
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
  const { showToast } = useToast();
  const { companies } = useApp();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('pick');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dayShifts, setDayShifts] = useState<Record<string, number>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const occasionsQuery = useApiQuery<SaudiOccasionDto[]>({
    queryKey: ['dashboard-saudi-occasions', companyId, year],
    queryFn: async () => ({
      success: true,
      data: await fetchSaudiOccasionsCatalog(year, companyId) as SaudiOccasionDto[],
    }),
    enabled: open && !!year && !!companyId,
    fallbackMessage: t('dashboardImportSaudiLoadFailed'),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
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
      const langCode = lang === 'en' ? 'en' : 'ar';
      const companyIds =
        scope === 'tenant' ? companies.map((c) => c.id) : [companyId];

      const res = await applyDashboardSpecialOccasions(companyId, {
        year,
        occasionIds: [...selected],
        scope,
        lang: langCode,
        companyIds: scope === 'tenant' ? companyIds : undefined,
        dayShifts: Object.keys(shiftsPayload).length ? shiftsPayload : undefined,
      });

      const data = res.success
        ? unwrapApiDataOr(res, { companies: 0, monthsUpdated: 0, occasionCount: 0 })
        : isSaudiOccasionsApiMissing(res)
          ? await applySaudiOccasionsViaCalendar({
              companyIds,
              year,
              occasionIds: [...selected],
              lang: langCode,
              dayShifts: Object.keys(shiftsPayload).length ? shiftsPayload : undefined,
            })
          : unwrapApiDataOr(res, { companies: 0, monthsUpdated: 0, occasionCount: 0 });
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.calendarRoot() });
      onApplied?.();
      const monthsHint =
        data.monthsUpdated > 0
          ? t('dashboardImportSaudiSuccessMonths', { 0: String(data.monthsUpdated) })
          : '';
      showToast(
        `${t('dashboardImportSaudiSuccess', {
          0: String(data.occasionCount || selected.size),
          1: String(data.companies || 1),
        })}${monthsHint ? ` ${monthsHint}` : ''}`,
        'success',
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
        <DialogActions
          size="sm"
          actions={[
            { key: 'back', label: t('dashboardBack'), role: 'cancel', disabled: applying, onClick: () => setStep('pick') },
            {
              key: 'company',
              label: t('dashboardImportSaudiScopeCompany'),
              role: 'secondary',
              disabled: applying,
              onClick: () => void runApply('company'),
            },
            {
              key: 'tenant',
              label: t('dashboardImportSaudiScopeTenant'),
              role: 'primary',
              disabled: applying,
              onClick: () => void runApply('tenant'),
            },
          ]}
        />
      );
    }
    return (
      <DialogActions
        size="sm"
        className="justify-between"
        actions={[
          {
            key: 'select-all',
            label: t('dashboardImportSaudiSelectAll'),
            role: 'secondary',
            disabled: !occasions.length || applying,
            onClick: selectAll,
          },
          {
            key: 'clear',
            label: t('dashboardImportSaudiClear'),
            role: 'secondary',
            disabled: !selected.size || applying,
            onClick: clearAll,
          },
          { key: 'cancel', label: t('cancel'), role: 'cancel', disabled: applying, onClick: onClose },
          {
            key: 'apply',
            label: applying ? t('loading') : t('dashboardImportSaudiApply'),
            role: 'primary',
            disabled: applying || occasionsQuery.isLoading,
            onClick: onApplyClick,
          },
        ]}
      />
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
          ) : occasionsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="m-0 text-[13px] text-noorix-red" role="alert">
                {occasionsQuery.error instanceof Error
                  ? occasionsQuery.error.message
                  : t('dashboardImportSaudiLoadFailed')}
              </p>
              <Button size="sm" variant="primary" onClick={() => void occasionsQuery.refetch()}>
                {t('retry')}
              </Button>
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
                        <Checkbox
                          className="mt-0.5 shrink-0"
                          checked={checked}
                          onChange={() => toggle(o.id)}
                        />
                        <ColorSwatch className="mt-1 h-3 w-3 shrink-0 rounded-sm" color={o.color} aria-hidden />
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
