import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useApp } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  applyDashboardSchoolHolidays,
  applyDashboardSpecialOccasions,
  getDashboardOccasionCatalog,
  type CalendarOccasionCatalogDto,
  type CalendarOccasionCatalogEventDto,
  type CalendarOccasionStatus,
  type SchoolHolidayVariant,
} from '../../../services/domains/apiEndpoints/dashboard-calendar';
import { dashboardKeys } from '../../../services/queryKeys/dashboard';
import { unwrapApiDataOr } from '../../../services/core/apiHttp';
import { Button, Checkbox, ColorSwatch, Modal, Spinner } from '../../../ui';
import { cn } from '../../../ui/cn';

type Props = {
  companyId: string;
  year: number;
  onApplied?: () => void;
};

type Scope = 'company' | 'tenant';

const STATUS_ORDER: CalendarOccasionStatus[] = ['current', 'upcoming', 'ended'];

const STATUS_LABELS: Record<CalendarOccasionStatus, string> = {
  current: 'حالية',
  upcoming: 'قادمة',
  ended: 'منتهية',
};

const VARIANT_LABELS: Record<SchoolHolidayVariant, string> = {
  general: 'التقويم العام',
  western: 'مكة/المدينة/جدة/الطائف',
};

const STATUS_EMPTY_LABELS: Record<CalendarOccasionStatus, string> = {
  current: 'لا توجد مناسبات حالية.',
  upcoming: 'لا توجد مناسبات قادمة.',
  ended: 'لا توجد مناسبات منتهية.',
};

const emptyCatalog: CalendarOccasionCatalogDto = {
  year: 0,
  today: '',
  schoolVariant: 'general',
  sources: {
    saudi: {
      nameAr: 'تقويم أم القرى والمناسبات الوطنية',
      nameEn: 'Umm al-Qura and Saudi national occasions',
      updatedAt: '',
      mode: 'calculated',
    },
    school: {
      nameAr: 'وزارة التعليم - التقويم الدراسي',
      nameEn: 'Ministry of Education academic calendar',
      primaryUrl: '',
      detailUrl: '',
      updatedAt: '',
    },
  },
  counts: { current: 0, upcoming: 0, ended: 0 },
  events: [],
};

function rangeLabel(event: CalendarOccasionCatalogEventDto): string {
  return event.fromDate === event.toDate ? event.fromDate : `${event.fromDate} - ${event.toDate}`;
}

function sourceLabel(event: CalendarOccasionCatalogEventDto, lang: 'ar' | 'en'): string {
  if (lang === 'en') return event.categoryEn;
  return event.categoryAr;
}

function eventLabel(event: CalendarOccasionCatalogEventDto, lang: 'ar' | 'en'): string {
  return lang === 'en' ? event.nameEn : event.nameAr;
}

function groupByStatus(events: CalendarOccasionCatalogEventDto[]) {
  const grouped: Record<CalendarOccasionStatus, CalendarOccasionCatalogEventDto[]> = {
    current: [],
    upcoming: [],
    ended: [],
  };
  for (const event of events) {
    grouped[event.status].push(event);
  }
  return grouped;
}

export function DashboardCalendarOccasionCenter({ companyId, year, onApplied }: Props) {
  const { lang, t } = useTranslation();
  const uiLang = lang === 'en' ? 'en' : 'ar';
  const { companies } = useApp();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<SchoolHolidayVariant>('general');
  const [scope, setScope] = useState<Scope>('company');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useApiQuery<CalendarOccasionCatalogDto>({
    queryKey: ['dashboard-calendar-occasion-catalog', companyId, year, variant],
    queryFn: () => getDashboardOccasionCatalog(year, variant, companyId),
    enabled: !!companyId && !!year,
    fallbackMessage: 'تعذر تحميل مركز المناسبات',
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const catalog = catalogQuery.data ?? emptyCatalog;
  const events = catalog.events ?? [];
  const companyCount = companies.length;
  const canApplyTenant = companyCount > 1;

  useEffect(() => {
    if (!open) {
      setError(null);
      setApplying(false);
      setSelectedKeys(new Set());
      setScope('company');
      return;
    }
    setSelectedKeys(new Set(events.map((event) => event.key)));
  }, [open, events]);

  useEffect(() => {
    if (!canApplyTenant) setScope('company');
  }, [canApplyTenant]);

  const grouped = useMemo(() => groupByStatus(events), [events]);
  const selectedEvents = useMemo(
    () => events.filter((event) => selectedKeys.has(event.key)),
    [events, selectedKeys],
  );

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(events.map((event) => event.key)));
  const clearAll = () => setSelectedKeys(new Set());

  const applySelected = async () => {
    if (!selectedEvents.length) {
      setError('اختر مناسبة واحدة على الأقل.');
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const companyIds = scope === 'tenant' ? companies.map((company) => company.id) : undefined;
      const saudiIds = selectedEvents
        .filter((event) => event.sourceKind === 'saudi')
        .map((event) => event.id);
      const schoolIds = selectedEvents
        .filter((event) => event.sourceKind === 'school')
        .map((event) => event.id);
      const langCode = uiLang;
      let monthsUpdated = 0;
      let eventCount = 0;

      if (saudiIds.length) {
        const res = await applyDashboardSpecialOccasions(companyId, {
          year,
          occasionIds: saudiIds,
          scope,
          companyIds,
          lang: langCode,
        });
        const data = unwrapApiDataOr(res, { companies: 0, monthsUpdated: 0, occasionCount: 0 });
        monthsUpdated += data.monthsUpdated;
        eventCount += data.occasionCount;
      }

      if (schoolIds.length) {
        const res = await applyDashboardSchoolHolidays(companyId, {
          year,
          variant,
          eventIds: schoolIds,
          scope,
          companyIds,
          lang: langCode,
        });
        const data = unwrapApiDataOr(res, { companies: 0, monthsUpdated: 0, eventCount: 0 });
        monthsUpdated += data.monthsUpdated;
        eventCount += data.eventCount;
      }

      await queryClient.invalidateQueries({ queryKey: dashboardKeys.calendarRoot() });
      onApplied?.();
      showToast(`تم تحديث ${eventCount || selectedEvents.length} مناسبة في ${monthsUpdated} شهر.`, 'success');
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحديث المناسبات.');
    } finally {
      setApplying(false);
    }
  };

  const modalFooter = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={selectAll} disabled={!events.length || applying}>
          تحديد الكل
        </Button>
        <Button size="sm" onClick={clearAll} disabled={!selectedKeys.size || applying}>
          مسح
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setOpen(false)} disabled={applying}>
          {t('cancel')}
        </Button>
        <Button size="sm" variant="primary" onClick={() => void applySelected()} disabled={applying || catalogQuery.isLoading}>
          {applying ? t('loading') : 'تطبيق التحديث'}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="noorix-surface-card mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="m-0 text-[14px] font-bold text-noorix-text">مركز تحديث المناسبات</h4>
            <p className="m-0 mt-1 text-[12px] text-noorix-muted">
              مصدر واحد للمناسبات السعودية وإجازات المدارس، مع تصنيف الحالة تلقائياً من الباكند.
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            تحديث المناسبات
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="rounded-md border border-noorix-border bg-noorix-bg-muted px-3 py-2">
              <div className="text-[11px] text-noorix-muted">{STATUS_LABELS[status]}</div>
              <div className="text-[16px] font-bold text-noorix-text">
                {catalogQuery.isLoading ? '-' : (catalog.counts[status] ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="مركز تحديث المناسبات" size="lg" footer={modalFooter}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-noorix-border bg-noorix-bg-muted p-3">
            <div>
              <div className="text-[12px] font-bold text-noorix-text">تقويم المدارس</div>
              <div className="text-[11px] text-noorix-muted">يستخدم للمناطق التي تختلف إجازاتها الدراسية.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['general', 'western'] as SchoolHolidayVariant[]).map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={variant === item ? 'primary' : 'secondary'}
                  onClick={() => setVariant(item)}
                  disabled={applying}
                >
                  {VARIANT_LABELS[item]}
                </Button>
              ))}
            </div>
          </div>

          {canApplyTenant && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-noorix-border p-3">
              <span className="text-[12px] font-bold text-noorix-text">نطاق التطبيق</span>
              <Button size="sm" variant={scope === 'company' ? 'primary' : 'secondary'} onClick={() => setScope('company')} disabled={applying}>
                الشركة الحالية
              </Button>
              <Button size="sm" variant={scope === 'tenant' ? 'primary' : 'secondary'} onClick={() => setScope('tenant')} disabled={applying}>
                كل الشركات
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="rounded-lg border border-noorix-border bg-noorix-surface p-3">
                <div className="text-[11px] text-noorix-muted">{STATUS_LABELS[status]}</div>
                <div className="text-[20px] font-bold text-noorix-text">{catalog.counts[status] ?? 0}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted p-3 text-[11px] text-noorix-muted">
            <div>المناسبات السعودية: حساب تلقائي من أم القرى والتواريخ الوطنية.</div>
            <div>إجازات المدارس: كتالوج داخلي موثق، آخر تحديث مصدر {catalog.sources.school.updatedAt || '-'}.</div>
            <div>تاريخ التقييم: {catalog.today || '-'}</div>
          </div>

          {error && (
            <p className="m-0 text-[12px] font-semibold text-noorix-red" role="alert">
              {error}
            </p>
          )}

          {catalogQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
              <span className="sr-only">{t('loading')}</span>
            </div>
          ) : catalogQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="m-0 text-[13px] text-noorix-red">تعذر تحميل المناسبات.</p>
              <Button size="sm" variant="primary" onClick={() => void catalogQuery.refetch()}>
                {t('retry')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {STATUS_ORDER.map((status) => {
                const items = grouped[status];
                return (
                  <section
                    key={status}
                    className="flex min-h-[220px] flex-col rounded-lg border border-noorix-border bg-noorix-surface"
                  >
                    <div className="flex items-center justify-between border-b border-noorix-border px-3 py-2">
                      <div className="text-[13px] font-bold text-noorix-text">{STATUS_LABELS[status]}</div>
                      <div className="rounded-md bg-noorix-bg-muted px-2 py-1 text-[11px] font-bold text-noorix-muted">
                        {items.length}
                      </div>
                    </div>
                    <div className="flex max-h-[min(54vh,440px)] flex-col gap-2 overflow-y-auto p-2">
                      {items.length === 0 ? (
                        <p className="m-0 rounded-md border border-dashed border-noorix-border bg-noorix-bg-muted px-3 py-6 text-center text-[12px] text-noorix-muted">
                          {STATUS_EMPTY_LABELS[status]}
                        </p>
                      ) : (
                        items.map((event) => {
                          const checked = selectedKeys.has(event.key);
                          return (
                            <label
                              key={event.key}
                              className={cn(
                                'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                                checked
                                  ? 'border-noorix-blue bg-[color-mix(in_srgb,var(--color-nx-sales)_8%,transparent)]'
                                  : 'border-noorix-border bg-noorix-surface',
                              )}
                            >
                              <Checkbox className="mt-0.5 shrink-0" checked={checked} onChange={() => toggleKey(event.key)} />
                              <ColorSwatch className="mt-1 h-3 w-3 shrink-0 rounded-sm" color={event.color} aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[13px] font-bold text-noorix-text">{eventLabel(event, uiLang)}</span>
                                  <span className="rounded bg-noorix-bg-muted px-1.5 py-px text-[11px] text-noorix-muted">
                                    {sourceLabel(event, uiLang)}
                                  </span>
                                </span>
                                <span className="block text-[11px] text-noorix-muted" dir="ltr">
                                  {rangeLabel(event)}
                                </span>
                                {event.academicYear && (
                                  <span className="block text-[11px] text-noorix-muted">
                                    العام الدراسي {event.academicYear}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
