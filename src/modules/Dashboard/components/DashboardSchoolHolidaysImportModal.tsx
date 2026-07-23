import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import {
  applyDashboardSchoolHolidays,
  getDashboardSchoolHolidays,
  type SchoolHolidayDto,
  type SchoolHolidayVariant,
} from '../../../services/domains/apiEndpoints/dashboard-calendar';
import { unwrapApiDataOr } from '../../../services/core/apiHttp';
import { dashboardKeys } from '../../../services/queryKeys/dashboard';
import { Button, Checkbox, ColorSwatch, DialogActions, Modal, Spinner } from '../../../ui';
import { cn } from '../../../ui/cn';

type Step = 'pick' | 'scope';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  year: number;
  onApplied?: () => void;
};

const emptyCatalog = {
  source: null,
  variant: 'general' as SchoolHolidayVariant,
  events: [] as SchoolHolidayDto[],
};

export function DashboardSchoolHolidaysImportModal({
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
  const [variant, setVariant] = useState<SchoolHolidayVariant>('general');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useApiQuery({
    queryKey: ['dashboard-school-holidays', companyId, year, variant],
    queryFn: () => getDashboardSchoolHolidays(year, variant, companyId),
    enabled: open && !!companyId && !!year,
    fallbackMessage: t('dashboardImportSchoolLoadFailed'),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const catalog = catalogQuery.data ?? emptyCatalog;
  const events = catalog.events ?? [];

  useEffect(() => {
    if (!open) {
      setStep('pick');
      setSelected(new Set());
      setError(null);
      return;
    }
    setSelected(new Set(events.map((event) => event.id)));
  }, [open, events]);

  const labelFor = (event: SchoolHolidayDto) => (lang === 'ar' ? event.nameAr : event.nameEn);

  const rangeFor = (event: SchoolHolidayDto) =>
    event.fromDate === event.toDate ? event.fromDate : `${event.fromDate} — ${event.toDate}`;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(events.map((event) => event.id)));
  const clearAll = () => setSelected(new Set());
  const companyCount = companies.length;
  const canApplyTenant = companyCount > 1;

  const runApply = async (scope: 'company' | 'tenant') => {
    if (!selected.size) {
      setError(t('dashboardImportSchoolNoSelection'));
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const companyIds = scope === 'tenant' ? companies.map((company) => company.id) : [companyId];
      const res = await applyDashboardSchoolHolidays(companyId, {
        year,
        variant,
        eventIds: [...selected],
        scope,
        lang: lang === 'en' ? 'en' : 'ar',
        companyIds: scope === 'tenant' ? companyIds : undefined,
      });
      const data = unwrapApiDataOr(res, { companies: 0, monthsUpdated: 0, eventCount: 0 });
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.calendarRoot() });
      onApplied?.();
      showToast(
        t('dashboardImportSchoolSuccess', {
          0: String(data.eventCount || selected.size),
          1: String(data.companies || 1),
          2: String(data.monthsUpdated || 0),
        }),
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
      setError(t('dashboardImportSchoolNoSelection'));
      return;
    }
    if (canApplyTenant) {
      setStep('scope');
      return;
    }
    void runApply('company');
  };

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
            disabled: !events.length || applying,
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
            disabled: applying || catalogQuery.isLoading,
            onClick: onApplyClick,
          },
        ]}
      />
    );
  }, [step, applying, events.length, selected.size, catalogQuery.isLoading, t, onClose, onApplyClick]);

  return (
    <Modal open={open} onClose={onClose} title={t('dashboardImportSchoolHolidays')} size="md" footer={footer}>
      {step === 'scope' ? (
        <div className="flex flex-col gap-3 text-[13px] text-noorix-text">
          <p className="m-0 text-noorix-muted">
            {t('dashboardImportSaudiScopeTenantCount', { 0: String(companyCount) })}
          </p>
          <ul className="m-0 list-disc ps-5 text-noorix-muted">
            {[...selected].map((id) => {
              const event = events.find((item) => item.id === id);
              return event ? <li key={id}>{labelFor(event)}</li> : null;
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[12px] text-noorix-muted">{t('dashboardImportSchoolHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={variant === 'general' ? 'primary' : 'secondary'}
              onClick={() => setVariant('general')}
              disabled={applying}
            >
              {t('dashboardImportSchoolVariantGeneral')}
            </Button>
            <Button
              size="sm"
              variant={variant === 'western' ? 'primary' : 'secondary'}
              onClick={() => setVariant('western')}
              disabled={applying}
            >
              {t('dashboardImportSchoolVariantWestern')}
            </Button>
          </div>
          {catalog.source && (
            <p className="m-0 text-[11px] text-noorix-muted">
              {t('dashboardImportSchoolSource', {
                0: lang === 'ar' ? catalog.source.nameAr : catalog.source.nameEn,
                1: catalog.source.updatedAt,
              })}
            </p>
          )}
          {error && (
            <p className="m-0 text-[12px] font-medium text-noorix-red" role="alert">
              {error}
            </p>
          )}
          {catalogQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
              <span className="sr-only">{t('dashboardImportSchoolLoading')}</span>
            </div>
          ) : catalogQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="m-0 text-[13px] text-noorix-red" role="alert">
                {catalogQuery.error instanceof Error
                  ? catalogQuery.error.message
                  : t('dashboardImportSchoolLoadFailed')}
              </p>
              <Button size="sm" variant="primary" onClick={() => void catalogQuery.refetch()}>
                {t('retry')}
              </Button>
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-[13px] text-noorix-muted py-6">{t('dashboardImportSchoolEmptyYear')}</p>
          ) : (
            <ul className="m-0 flex flex-col gap-2 max-h-[min(52vh,360px)] overflow-y-auto">
              {events.map((event) => {
                const checked = selected.has(event.id);
                return (
                  <li key={event.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        checked
                          ? 'border-noorix-blue bg-[color-mix(in_srgb,var(--color-nx-sales)_8%,transparent)]'
                          : 'border-noorix-border bg-noorix-surface',
                      )}
                    >
                      <Checkbox className="mt-0.5 shrink-0" checked={checked} onChange={() => toggle(event.id)} />
                      <ColorSwatch className="mt-1 h-3 w-3 shrink-0 rounded-sm" color={event.color} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="text-[13px] font-semibold text-noorix-text">{labelFor(event)}</span>
                        <span className="block text-[11px] text-noorix-muted ltr" dir="ltr">
                          {rangeFor(event)}
                        </span>
                        <span className="block text-[11px] text-noorix-muted">
                          {t('dashboardImportSchoolAcademicYear', { 0: event.academicYear })}
                        </span>
                      </span>
                    </label>
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
