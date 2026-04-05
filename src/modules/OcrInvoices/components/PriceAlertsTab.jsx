import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';

export default function PriceAlertsTab({ alerts = [], loading }) {
  const { t, language } = useTranslation();
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>⏳ جاري التحميل...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--noorix-text-muted)' }} dir={dir}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{t('ocrNoPriceAlerts')}</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>جميع الأسعار في النطاق الطبيعي.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} dir={dir}>
      <div style={{ fontSize: 14, color: 'var(--noorix-text-muted)', marginBottom: 4 }}>
        {alerts.length} تنبيه سعري — الأصناف التي اشتُريت بأعلى من أفضل سعر تاريخي لها
      </div>

      {alerts.map((alert, i) => (
        <div
          key={`${alert.itemId}-${i}`}
          className="noorix-surface-card"
          style={{ padding: '18px 20px', borderRight: '4px solid #dc2626' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{alert.itemName}</div>
                {alert.category && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                    {alert.category}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 2 }}>{t('ocrLatestPrice')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{alert.latestPrice.toLocaleString('ar-SA')} ريال</div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{alert.latestSupplier}</div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 2 }}>{t('ocrBestPrice')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>{alert.lowestPrice.toLocaleString('ar-SA')} ريال</div>
                  <div style={{ fontSize: 11, color: 'var(--noorix-text-muted)' }}>{alert.lowestSupplier}</div>
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginBottom: 2 }}>متوسط السعر</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{alert.averagePrice.toLocaleString('ar-SA')} ريال</div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,0.1)', minWidth: 80 }}>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{t('ocrPriceIncrease')}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#dc2626' }}>+{alert.priceIncreasePercent}%</div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.06)', fontSize: 13 }}>
            💡 <strong>{t('ocrCheaperSupplier')}:</strong> {alert.lowestSupplier} — يقدمه بـ {alert.lowestPrice.toLocaleString('ar-SA')} ريال
            (توفير {(alert.latestPrice - alert.lowestPrice).toLocaleString('ar-SA')} ريال للوحدة)
          </div>
        </div>
      ))}
    </div>
  );
}
