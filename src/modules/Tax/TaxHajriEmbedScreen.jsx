/**
 * تضمين تطبيق ‎tax-hajri‎ (مسار ‎/tax/‎) داخل إطار نوريكس — منفصل عن تقارير نوريكس ‎/reports/tax‎.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { apiGet } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../ui';
import {
  buildHajriTaxEmbeddedUrl,
  getHajriTaxAppPublicBase,
  resolveTaxHajriSegment,
} from './taxEmbeddedUrl';

export default function TaxHajriEmbedScreen() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { pathname } = useLocation();
  const segment = useMemo(() => resolveTaxHajriSegment(pathname), [pathname]);

  const { data, isPending, isError, refetch, isFetching, isSuccess } = useQuery({
    queryKey: ['hajri-tax-launch-url'],
    queryFn: async () => {
      const res = await apiGet('/api/v1/owner/hajri-tax/launch-url');
      if (!res?.success) {
        showToast(res?.error || t('hajriTaxLaunchFailed'), 'error');
        return { url: `${getHajriTaxAppPublicBase()}/` };
      }
      return { url: res.data?.url || `${getHajriTaxAppPublicBase()}/` };
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const iframeSrc = useMemo(() => {
    const launch = data?.url || `${getHajriTaxAppPublicBase()}/`;
    return buildHajriTaxEmbeddedUrl(launch, segment);
  }, [data?.url, segment]);

  const iframeBlockedSameApp = useMemo(() => {
    if (typeof window === 'undefined' || !iframeSrc) return false;
    try {
      const u = new URL(iframeSrc);
      if (u.origin !== window.location.origin) return false;
      const p = u.pathname.replace(/\/$/, '') || '/';
      return p === '/hajri-tax' || p.startsWith('/hajri-tax/');
    } catch {
      return false;
    }
  }, [iframeSrc]);

  const openExternal = () => {
    window.open(iframeSrc, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-3 w-full min-h-0 -m-4 sm:-m-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
        <p className="text-sm text-[var(--noorix-text-muted)] m-0">{t('taxHajriEmbedBlurb')}</p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            className="inline-flex items-center gap-2"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <span className={`inline-block ${isFetching ? 'animate-spin' : ''}`} aria-hidden>
              ↻
            </span>
            {t('refresh')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="inline-flex items-center gap-2 border border-[var(--noorix-border)]"
            onClick={openExternal}
          >
            <span aria-hidden>↗</span>
            {t('hajriTaxOpenInNewTab')}
          </Button>
        </div>
      </div>

      <div className="relative w-full flex-1 min-h-[min(78vh,880px)] rounded-xl border border-[var(--noorix-border)] bg-[var(--noorix-bg)] overflow-hidden shadow-inner">
        {(isPending || isError) && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--noorix-bg)]/90 backdrop-blur-[2px]"
            role="status"
            aria-busy={isPending}
          >
            {isPending && (
              <>
                <div className="w-10 h-10 border-4 border-[var(--noorix-border)] border-t-[var(--noorix-blue)] rounded-full animate-spin" />
                <span className="text-sm text-[var(--noorix-text-muted)]">{t('loading')}</span>
              </>
            )}
            {isError && !isPending && (
              <>
                <p className="text-sm text-[var(--noorix-text-muted)] text-center px-4">{t('loadingError')}</p>
                <Button type="button" variant="primary" onClick={() => refetch()}>
                  {t('retry')}
                </Button>
              </>
            )}
          </div>
        )}
        {isSuccess && data && iframeBlockedSameApp && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-6 text-center bg-[var(--noorix-bg-surface)]">
            <p className="text-sm text-[var(--noorix-text)] m-0 max-w-md">{t('hajriTaxEmbedBlocked')}</p>
          </div>
        )}
        {isSuccess && data && !iframeBlockedSameApp && (
          <iframe
            key={iframeSrc}
            title={t('hajriTaxEmbedTitle')}
            src={iframeSrc}
            className="absolute inset-0 w-full h-full border-0 bg-white"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </div>
  );
}
