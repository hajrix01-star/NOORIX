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
    9: { borderRadius: 16, border: '1px solid var(--noorix-blue-20)', boxShadow: '0 2px 12px var(--noorix-blue-8), inset 0 1px 0 rgba(255,255,255,0.5)' },
    10: { borderRadius: 12, border: '2px solid var(--noorix-border)', boxShadow: 'inset 0 0 0 1px var(--noorix-border-muted)' },
  };

  const s = previewStyles[styleId] || previewStyles[1];

  return (
    <div
      className="bg-noorix-surface p-5 flex flex-col cursor-pointer min-h-[140px] justify-between"
      style={{
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
        <div className="text-[11px] font-bold text-noorix-muted mb-1 tracking-[0.05em]">#{styleId}</div>
        <div className="text-[15px] font-bold text-noorix-text">{name}</div>
        <div className="text-[12px] text-noorix-muted mt-1">{desc}</div>
      </div>
      <div className="flex gap-2 mt-3">
        <span className="text-[11px] font-semibold text-noorix-green py-1 px-2 rounded-md" style={{ background: 'var(--noorix-green-10)' }}>12,500 ﷼</span>
        <span className="text-[11px] bg-noorix-bg-muted text-noorix-muted py-1 px-2 rounded-md">مثال</span>
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
    <div className="p-6 max-w-[1200px]">
      <div className="mb-6">
        <h1 className="font-extrabold m-0 text-[22px]">{t('themePreview')}</h1>
        <p className="mt-2 text-noorix-muted text-[14px]">
          {lang === 'ar' ? 'اختر شكلاً للكروت لتطبيقه على النظام كاملاً. اضغط على أي كرت لتحديده.' : 'Select a card style to apply across the entire system. Click any card to select it.'}
        </p>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
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

      <div className="p-4 bg-noorix-bg-muted rounded-xl text-[13px] text-noorix-muted mt-6">
        <strong className="text-noorix-text">
          {lang === 'ar' ? `الشكل المحدد حاليًا: #${currentStyle}` : `Current selection: #${currentStyle}`}
        </strong>
        {' — '}
        {lang === 'ar' ? 'سيُطبَّق على جميع الكروت والجداول في لوحة التحكم، التقارير، الخزائن، الفواتير، وغيرها.' : 'Will be applied to all cards and tables in Dashboard, Reports, Vaults, Invoices, and more.'}
      </div>
    </div>
  );
}
