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

  const dateRangeLabel = useCallback((o: SaudiOccasionDto) => {
    return o.fromDate === o.toDate ? o.fromDate : `${o.fromDate} — ${o.toDate}`;
  }, []);

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
      const res = await applyDashboardSpecialOccasions(companyId, {
        year,
        occasionIds: [...selected],
        scope,
        lang: lang === 'en' ? 'en' : 'ar',
        companyIds: scope === 'tenant' ? companies.map((c) => c.id) : undefined,
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
              return o ? <li key={id}>{labelFor(o)}</li> : null;
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[12px] text-noorix-muted">{t('dashboardImportSaudiOccasionsHint')}</p>
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
                return (
                  <li key={o.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        checked
                          ? 'border-noorix-blue bg-[color-mix(in_srgb,var(--color-nx-sales)_8%,transparent)]'
                          : 'border-noorix-border bg-noorix-surface hover:bg-noorix-bg-muted/60',
                      )}
                    >
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
