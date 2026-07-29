/**
 * ThemePreviewScreen — معاينة الثيم: أشكال الكروت + معرض مكوّنات مرقّم للمرجعية
 */
import React, { useMemo } from 'react';
import { useTabSearchParam } from '../../hooks/useTabSearchParam';
import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { CARD_STYLES, CARD_STYLE_KEY } from '../../constants/cardStyles';
import type { CardStyleDefinition, CardStyleId } from '../../constants/cardStyles';
import { ScreenShell, ScreenTitle, ScreenTabs } from '../../ui';
import ThemeFiltersV2Tab from './ThemeFiltersV2Tab';
import ThemeFiltersV3Tab from './ThemeFiltersV3Tab';
import ThemeGeneralReportConceptTab from './ThemeGeneralReportConceptTab';
import ThemeGlobalTableConceptTab from './ThemeGlobalTableConceptTab';
import ThemeProfitLossConceptTab from './ThemeProfitLossConceptTab';
import ThemeTableContainersTab from './ThemeTableContainersTab';
import { ShadcnInspiredDateFilterSamples } from './ThemeDateFilterSamples';
import ThemeUILabTab from './ThemeUILabTab';

type ThemePreviewTabId =
  | 'filters'
  | 'filtersV2'
  | 'filtersV3'
  | 'cards'
  | 'tables'
  | 'globalTable'
  | 'generalReportConcept'
  | 'profitLossConcept'
  | 'uilab';

type CardPreviewProps = CardStyleDefinition & {
  styleId: CardStyleId;
  isSelected: boolean;
  onSelect: (id: CardStyleId) => void;
  lang: string;
};

function CardPreview({ styleId, nameAr, nameEn, descAr, descEn, isSelected, onSelect, lang }: CardPreviewProps) {
  const name = lang === 'ar' ? nameAr : nameEn;
  const desc = lang === 'ar' ? descAr : descEn;
  const previewClass = `nx-theme-card-preview nx-theme-card-preview--${Number(styleId) || 1}${isSelected ? ' nx-theme-card-preview--selected' : ''}`;

  return (
    <div
      className={`${previewClass} bg-noorix-surface p-5 flex flex-col cursor-pointer min-h-[140px] justify-between`}
      onClick={() => onSelect(styleId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') onSelect(styleId); }}
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

const THEME_PREVIEW_TAB_IDS: readonly ThemePreviewTabId[] = [
  'filters',
  'filtersV2',
  'filtersV3',
  'cards',
  'tables',
  'globalTable',
  'generalReportConcept',
  'profitLossConcept',
  'uilab',
];

export default function ThemePreviewScreen() {
  const { t, lang } = useTranslation();
  const { cardStyle, setCardStyle } = useApp();
  const currentStyle = cardStyle ?? 1;
  const [activeTab, setActiveTab] = useTabSearchParam(THEME_PREVIEW_TAB_IDS, 'filters');

  const tabItems = useMemo(
    () => [
      { id: 'filters', label: t('themePreviewTabFilters') },
      { id: 'filtersV2', label: lang === 'ar' ? 'فلاتر 2' : 'Filters 2' },
      { id: 'filtersV3', label: lang === 'ar' ? 'فلتر مقترح 1' : 'Proposed Filter 1' },
      { id: 'cards', label: t('themePreviewTabCards') },
      { id: 'tables', label: lang === 'ar' ? 'حاويات الجداول' : 'Table surfaces' },
      { id: 'globalTable', label: lang === 'ar' ? 'ثيم جداول عالمي' : 'Global table theme' },
      { id: 'generalReportConcept', label: lang === 'ar' ? 'تقرير عام تجريبي' : 'General report concept' },
      { id: 'profitLossConcept', label: lang === 'ar' ? 'تقرير الربح والخسارة' : 'Profit and loss concept' },
      { id: 'uilab', label: t('themePreviewTabUILab') },
    ],
    [lang, t],
  );

  const handleSelect = (id: CardStyleId) => {
    setCardStyle(id);
    try {
      localStorage.setItem(CARD_STYLE_KEY, String(id));
    } catch {}
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
        {activeTab === 'filters' && (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-noorix-muted m-0">{t('themePreviewLab13Hint')}</p>
            <ShadcnInspiredDateFilterSamples t={t} />
          </div>
        )}
        {activeTab === 'filtersV2' && <ThemeFiltersV2Tab />}
        {activeTab === 'filtersV3' && <ThemeFiltersV3Tab />}
        {activeTab === 'cards' && (
          <div className="flex flex-col gap-5">
            <p className="text-[14px] text-noorix-muted m-0">{t('themePreviewCardsIntro')}</p>
            <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {CARD_STYLES.map((item) => (
                <CardPreview
                  key={item.id}
                  id={item.id}
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
        {activeTab === 'tables' && <ThemeTableContainersTab />}
        {activeTab === 'globalTable' && <ThemeGlobalTableConceptTab />}
        {activeTab === 'generalReportConcept' && <ThemeGeneralReportConceptTab />}
        {activeTab === 'profitLossConcept' && <ThemeProfitLossConceptTab />}
        {activeTab === 'uilab' && <ThemeUILabTab />}
      </ScreenTabs>
    </ScreenShell>
  );
}
