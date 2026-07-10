/**
 * TaxSettingsTab — إعدادات الضريبة للشركة النشطة
 * تفعيل ضريبة القيمة المضافة للمبيعات ونسبة الضريبة (%)
 */
import React, { type ChangeEvent, useState, useEffect } from 'react';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { useApp } from '../../../context/AppContext';
import { getCompany, updateCompany } from '../../../services/api';
import { Button, Checkbox, Input } from '../../../ui';
import { appKeys, companyKeys } from '../../../services/queryKeys';

type TaxCompanySettings = {
  vatEnabledForSales?: boolean | null;
  vatRatePercent?: number | string | null;
};

type TaxCompanyPatch = {
  vatEnabledForSales: boolean;
  vatRatePercent: number;
};

export default function TaxSettingsTab() {
  const { activeCompanyId } = useApp();

  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState(15);

  const { data: company, isLoading, isError, error } = useApiQuery<TaxCompanySettings>({
    queryKey: companyKeys.single(activeCompanyId || ''),
    queryFn: () => getCompany(activeCompanyId),
    fallbackMessage: 'تعذر تحميل إعدادات الشركة',
    enabled: !!activeCompanyId,
  });

  useEffect(() => {
    if (company) {
      setVatEnabled(!!company.vatEnabledForSales);
      const rate = company.vatRatePercent;
      setVatRate(rate != null ? Number(rate) : 15);
    }
  }, [company]);

  const updateMutation = useApiMutation({
    mutationFn: (body: TaxCompanyPatch) => updateCompany(activeCompanyId, body),
    invalidateQueries: [companyKeys.single(activeCompanyId || ''), appKeys.companiesRoot()],
    showErrorToast: false,
  });

  function handleSave() {
    if (!activeCompanyId) return;
    updateMutation.mutate({
      vatEnabledForSales: vatEnabled,
      vatRatePercent: vatRate,
    });
  }

  const hasChanges =
    company &&
    (!!company.vatEnabledForSales !== vatEnabled ||
      Number(company.vatRatePercent ?? 15) !== vatRate);

  if (!activeCompanyId) {
    return (
      <div className="text-center text-noorix-muted p-8">
        <div className="mb-3 text-[40px]">—</div>
        <p className="text-[14px] m-0">يجب اختيار شركة أولاً من القائمة العلوية.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center text-noorix-muted p-8">
        جاري التحميل...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-noorix-red p-8 text-[13px]">
        {error?.message || 'تعذر تحميل إعدادات الشركة.'}
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 max-w-[480px] gap-6">
      <div>
        <h3 className="text-[18px] m-0 mb-2">إعدادات الضريبة</h3>
        <p className="text-[13px] text-noorix-muted m-0">
          تفعيل ضريبة القيمة المضافة للمبيعات ونسبة الضريبة المستخدمة في الحسابات.
        </p>
      </div>

      <div className="noorix-surface-card p-5">
        <div className="flex flex-col gap-3">
          {/* مفتاح التفعيل */}
          <div className="flex flex-col gap-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between rounded-xl border border-noorix-border bg-noorix-bg-muted py-3 px-[14px]">
            <label className="block text-[14px] font-semibold m-0 min-w-0">تفعيل ضريبة القيمة المضافة للمبيعات</label>
            <Checkbox
              checked={vatEnabled}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setVatEnabled(e.target.checked)}
              label={<span className="text-[13px] text-noorix-muted">{vatEnabled ? 'مفعّل' : 'معطّل'}</span>}
              containerClassName="nx-checkbox m-0 nx-checkbox--tight nx-checkbox--accent-green"
            />
          </div>

          {/* نسبة الضريبة */}
          <div>
            <Input
              type="number"
              label="نسبة الضريبة (%)"
              min={0}
              max={100}
              step={0.01}
              value={vatRate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setVatRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            />
            <p className="text-[12px] text-noorix-muted mt-1.5 mb-0">
              القيمة الافتراضية 15% (ZATCA / السعودية)
            </p>
          </div>

          {hasChanges && (
            <div className="rounded-xl text-[13px] py-[10px] px-[14px] leading-[1.6] bg-noorix-amber/10 border border-noorix-amber/35 text-noorix-text">
              <strong>⚠️ تنبيه مهم:</strong> تغيير إعدادات الضريبة سيُطبَّق على <strong>الفواتير والمعاملات الجديدة فقط</strong>. الفواتير والسجلات المحفوظة مسبقاً لن تتأثر بهذا التغيير ولن تُعاد حسابها تلقائياً.
            </div>
          )}

          {hasChanges && (
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full min-h-[44px] sm:w-auto sm:self-start"
            >
              {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          )}

          {updateMutation.isSuccess && (
            <span className="text-[13px] text-noorix-green">تم حفظ الإعدادات بنجاح.</span>
          )}
          {updateMutation.isError && (
            <span className="text-[13px] text-noorix-red">{updateMutation.error?.message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
