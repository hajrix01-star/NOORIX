/**
 * TaxSettingsTab — إعدادات الضريبة للشركة النشطة
 * تفعيل ضريبة القيمة المضافة للمبيعات ونسبة الضريبة (%)
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { getCompany, updateCompany } from '../../../services/api';
import { Button, Input } from '../../../ui';

export default function TaxSettingsTab() {
  const queryClient = useQueryClient();
  const { activeCompanyId } = useApp();

  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState(15);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', activeCompanyId],
    queryFn: async () => {
      const res = await getCompany(activeCompanyId);
      if (!res?.success) return null;
      return res.data;
    },
    enabled: !!activeCompanyId,
  });

  useEffect(() => {
    if (company) {
      setVatEnabled(!!company.vatEnabledForSales);
      const rate = company.vatRatePercent;
      setVatRate(rate != null ? Number(rate) : 15);
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: async (body) => {
      const res = await updateCompany(activeCompanyId, body);
      if (!res?.success) throw new Error(res?.error || 'فشل تحديث الإعدادات');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', activeCompanyId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
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

  return (
    <div className="grid gap-6 max-w-[480px]">
      <div>
        <h3 className="text-[18px] m-0 mb-2">إعدادات الضريبة</h3>
        <p className="text-[13px] text-noorix-muted m-0">
          تفعيل ضريبة القيمة المضافة للمبيعات ونسبة الضريبة المستخدمة في الحسابات.
        </p>
      </div>

      <div className="noorix-surface-card p-5 rounded-xl">
        <div className="flex flex flex-col gap-3">
          {/* مفتاح التفعيل */}
          <div className="flex items-center justify-between border border-noorix-border rounded-xl bg-noorix-surface py-3 px-[14px]">
            <label className="block text-[14px] font-semibold m-0">تفعيل ضريبة القيمة المضافة للمبيعات</label>
            <label className="nx-checkbox m-0 nx-checkbox--tight nx-checkbox--accent-green">
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
              />
              <span className="text-[13px] text-noorix-muted">{vatEnabled ? 'مفعّل' : 'معطّل'}</span>
            </label>
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
              onChange={(e) => setVatRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
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
              className="self-start"
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
