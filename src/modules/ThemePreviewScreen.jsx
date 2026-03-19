/**
 * ThemePreviewScreen — معاينة الثيم واختيار أشكال الكروت
 * 10 أشكال احترافية للكروت — اختيار واحد لتطبيقه على النظام كاملاً
 */
import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import { CARD_STYLES, CARD_STYLE_KEY } from '../constants/cardStyles';

function CardPreview({ styleId, nameAr, nameEn, descAr, descEn, isSelected, onSelect, lang }) {
  const name = lang === 'ar' ? nameAr : nameEn;
  const desc = lang === 'ar' ? descAr : descEn;

  const previewStyles = {
    1: { borderRadius: 14, border: '1px solid var(--noorix-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    2: { borderRadius: 16, border: '1px solid var(--noorix-border)', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' },
    3: { borderRadius: 16, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
    4: { borderRadius: 16, border: 'none', background: 'var(--noorix-bg-surface)', boxShadow: '6px 6px 14px rgba(0,0,0,0.08), -6px -6px 14px rgba(255,255,255,0.9)' },
    5: { borderRadius: 14, border: '1px solid var(--noorix-border)', borderInlineStart: '4px solid #16a34a', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    6: { borderRadius: 14, border: '2px solid transparent', background: 'linear-gradient(var(--noorix-bg-surface), var(--noorix-bg-surface)) padding-box, linear-gradient(135deg, #16a34a, #2563eb) border-box', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    7: { borderRadius: 16, border: '1px solid var(--noorix-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' },
    8: { borderRadius: 4, border: '1px solid var(--noorix-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
    9: { borderRadius: 16, border: '1px solid rgba(37,99,235,0.2)', boxShadow: '0 2px 12px rgba(37,99,235,0.08), inset 0 1px 0 rgba(255,255,255,0.5)' },
    10: { borderRadius: 12, border: '2px solid var(--noorix-border)', boxShadow: 'inset 0 0 0 1px var(--noorix-border-muted)' },
  };

  const s = previewStyles[styleId] || previewStyles[1];

  return (
    <div
      style={{
        background: 'var(--noorix-bg-surface)',
        padding: 20,
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        outline: isSelected ? '2px solid var(--noorix-accent-blue)' : 'none',
        outlineOffset: 2,
        ...s,
      }}
      onClick={() => onSelect(styleId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(styleId); }}
    >
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--noorix-text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>#{styleId}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--noorix-text)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginTop: 4 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <span style={{ fontSize: 11, padding: '4px 8px', background: 'rgba(22,163,74,0.1)', color: '#16a34a', borderRadius: 6, fontWeight: 600 }}>12,500 ﷼</span>
        <span style={{ fontSize: 11, padding: '4px 8px', background: 'var(--noorix-bg-muted)', color: 'var(--noorix-text-muted)', borderRadius: 6 }}>مثال</span>
      </div>
    </div>
  );
}

export default function ThemePreviewScreen() {
  const { t } = useTranslation();
  const { cardStyle, setCardStyle, language } = useApp();
  const lang = language || 'ar';
  const currentStyle = cardStyle ?? 1;

  const handleSelect = (id) => {
    setCardStyle(id);
    try {
      localStorage.setItem(CARD_STYLE_KEY, String(id));
    } catch (_) {}
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('themePreview')}</h1>
        <p style={{ marginTop: 8, color: 'var(--noorix-text-muted)', fontSize: 14 }}>
          {lang === 'ar' ? 'اختر شكلاً للكروت لتطبيقه على النظام كاملاً. اضغط على أي كرت لتحديده.' : 'Select a card style to apply across the entire system. Click any card to select it.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
        {CARD_STYLES.map((item) => (
          <CardPreview
            key={item.id}
            styleId={item.id}
            nameAr={item.nameAr}
            nameEn={item.nameEn}
            descAr={item.descAr}
            descEn={item.descEn}
            isSelected={currentStyle === item.id}
            onSelect={handleSelect}
            lang={lang}
          />
        ))}
      </div>

      <div style={{ marginTop: 24, padding: 16, background: 'var(--noorix-bg-muted)', borderRadius: 12, fontSize: 13, color: 'var(--noorix-text-muted)' }}>
        <strong style={{ color: 'var(--noorix-text)' }}>
          {lang === 'ar' ? `الشكل المحدد حاليًا: #${currentStyle}` : `Current selection: #${currentStyle}`}
        </strong>
        {' — '}
        {lang === 'ar' ? 'سيُطبَّق على جميع الكروت والجداول في لوحة التحكم، التقارير، الخزائن، الفواتير، وغيرها.' : 'Will be applied to all cards and tables in Dashboard, Reports, Vaults, Invoices, and more.'}
      </div>
    </div>
  );
}
