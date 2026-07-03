/**
 * ThemePreviewScreen — معاينة الثيم: أشكال الكروت + معرض مكوّنات مرقّم للمرجعية
 */
import React, { useMemo } from 'react';
import { useTabSearchParam } from '../hooks/useTabSearchParam';
import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import { CARD_STYLES, CARD_STYLE_KEY } from '../constants/cardStyles';
import { ScreenShell, ScreenTitle, ScreenTabs } from '../ui';
import ThemeUILabTab from './themePreview/ThemeUILabTab';

function CardPreview({ styleId, nameAr, nameEn, descAr, descEn, isSelected, onSelect, lang }: any) {
  const name = lang === 'ar' ? nameAr : nameEn;
  const desc = lang === 'ar' ? descAr : descEn;
  const previewClass = `nx-theme-card-preview nx-theme-card-preview--${Number(styleId) || 1}${isSelected ? ' nx-theme-card-preview--selected' : ''}`;

  return (
    <div
      className={`${previewClass} bg-noorix-surface p-5 flex flex-col cursor-pointer min-h-[140px] justify-between`}
      onClick={() => onSelect(styleId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: any) => { if (e.key === 'Enter' || e.key === ' ') onSelect(styleId); }}
    >
      <div>
        <div className="text-[11px] font-bold text-noorix-muted mb-1 tracking-[0.05em]">#{styleId}</div>
        <div className="text-[15px] font-bold text-noorix-text">{name}</div>
        <div className="text-[12px] text-noorix-muted mt-1">{desc}</div>
      </div>
      <div className="flex gap-2 mt-3">
        <span className="text-[11px] font-semibold text-noorix-green py-1 px-2 rounded-md bg-[var(--noorix-green-10)]">12,500 SR</span>
        <span className="text-[11px] bg-noorix-bg-muted text-noorix-muted py-1 px-2 rounded-md">مثال</span>
      </div>
    </div>
  );
}

const THEME_PREVIEW_TAB_IDS = ['cards', 'uilab'];

export default function ThemePreviewScreen() {
  const { t, lang } = useTranslation();
  const { cardStyle, setCardStyle } = useApp();
  const currentStyle = cardStyle ?? 1;
  const [activeTab, setActiveTab] = useTabSearchParam(THEME_PREVIEW_TAB_IDS, 'cards');

  const tabItems = useMemo(
    () => [
      { id: 'cards', label: t('themePreviewTabCards') },
      { id: 'uilab', label: t('themePreviewTabUILab') },
    ],
    [t],
  );

  const handleSelect = (id: any) => {
    setCardStyle(id);
    try {
      localStorage.setItem(CARD_STYLE_KEY, String(id));
    } catch (_: any) {}
  };

  return (
    <ScreenShell className="max-w-[1200px]">
      <div>
        <ScreenTitle>{t('themePreview')}</ScreenTitle>
        <p className="text-[13px] text-noorix-muted m-0 mt-1">{t('themePreviewDesc')}</p>
      </div>

      <ScreenTabs
        items={tabItems}
        value={activeTab}
        onChange={setActiveTab}
        contentClassName="nx-tab-content p-4 md:p-5"
      >
        {activeTab === 'cards' && (
          <div className="flex flex-col gap-5">
            <p className="text-[14px] text-noorix-muted m-0">{t('themePreviewCardsIntro')}</p>
            <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {CARD_STYLES.map((item: any) => (
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
            <div className="p-4 bg-noorix-bg-muted rounded-xl text-[13px] text-noorix-muted">
              <strong className="text-noorix-text">
                {t('themePreviewCurrent')} #{currentStyle}
              </strong>
              {' — '}
              {t('themePreviewCardsFooter')}
            </div>
          </div>
        )}
        {activeTab === 'uilab' && <ThemeUILabTab />}
      </ScreenTabs>
    </ScreenShell>
  );
}
