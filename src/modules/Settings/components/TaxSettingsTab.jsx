/**
 * TaxSettingsTab — إعدادات الضريبة للشركة النشطة
 * تفعيل ضريبة القيمة المضافة للمبيعات ونسبة الضريبة (%)
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../../../context/AppContext';
import { getCompany, updateCompany } from '../../../services/api';
import { labelStyle } from '../constants/settingsConstants';
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
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>—</div>
        <p style={{ margin: 0, fontSize: 14 }}>يجب اختيار شركة أولاً من القائمة العلوية.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>
        جاري التحميل...
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 480 }}>
      <div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>إعدادات الضريبة</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
          تفعيل ضريبة القيمة المضافة للمبيعات ونسبة الضريبة المستخدمة في الحسابات.
        </p>
      </div>

      <div className="noorix-surface-card" style={{ padding: 20, borderRadius: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* مفتاح التفعيل */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: 'var(--noorix-bg-surface)', border: '1px solid var(--noorix-border)' }}>
            <label style={{ ...labelStyle, margin: 0, fontWeight: 600 }}>تفعيل ضريبة القيمة المضافة للمبيعات</label>
            <label className="nx-checkbox" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--noorix-accent-green)' }}
              />
              <span style={{ marginRight: 8, fontSize: 13, color: 'var(--noorix-text-muted)' }}>{vatEnabled ? 'مفعّل' : 'معطّل'}</span>
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
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
              القيمة الافتراضية 15% (ZATCA / السعودية)
            </p>
          </div>

          {hasChanges && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.35)',
              fontSize: 13,
              color: 'var(--noorix-text-default)',
              lineHeight: 1.6,
            }}>
              <strong>⚠️ تنبيه مهم:</strong> تغيير إعدادات الضريبة سيُطبَّق على <strong>الفواتير والمعاملات الجديدة فقط</strong>. الفواتير والسجلات المحفوظة مسبقاً لن تتأثر بهذا التغيير ولن تُعاد حسابها تلقائياً.
            </div>
          )}

          {hasChanges && (
            <Button
              type="button"
              variant="success"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              style={{ alignSelf: 'flex-start' }}
            >
              {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          )}

          {updateMutation.isSuccess && (
            <span style={{ fontSize: 13, color: 'var(--noorix-accent-green)' }}>تم حفظ الإعدادات بنجاح.</span>
          )}
          {updateMutation.isError && (
            <span style={{ fontSize: 13, color: 'var(--noorix-accent-red)' }}>{updateMutation.error?.message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
