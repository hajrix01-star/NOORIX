import { useState } from 'react';
import { Button, DateField } from '../../ui';
import type { ThemePreviewTranslate } from './themePreviewModel';
export function ShadcnInspiredDateFilterSamples({ t }: { t: ThemePreviewTranslate }) {
  const [active, setActive] = useState('month');
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedDay, setSelectedDay] = useState('2026-07-04');
  const [rangeStart, setRangeStart] = useState('2026-07-01');
  const [rangeEnd, setRangeEnd] = useState('2026-07-31');
  const [selectedQuarter, setSelectedQuarter] = useState('Q3');
  const [selectedMonth, setSelectedMonth] = useState('Jul');
  const [selectedYear, setSelectedYear] = useState('2026');
  const modes = [
    { id: 'all', label: t('themePreviewLab13All') },
    { id: 'day', label: t('themePreviewLab13Day') },
    { id: 'month', label: t('themePreviewLab13Month') },
    { id: 'quarter', label: t('themePreviewLab13Quarter') },
    { id: 'year', label: t('themePreviewLab13Year') },
    { id: 'range', label: t('themePreviewLab13Range') },
  ];
  const activeLabel = modes.find((mode) => mode.id === active)?.label || t('themePreviewLab13Month');
  const periodLabel = active === 'all'
    ? t('themePreviewLab13All')
    : active === 'day'
      ? selectedDay
      : active === 'month'
        ? `${selectedMonth} ${selectedYear}`
        : active === 'quarter'
          ? `${selectedQuarter} / ${selectedYear}`
          : active === 'year'
            ? selectedYear
            : `${rangeStart} - ${rangeEnd}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = ['2024', '2025', '2026', '2027'];
  const quarterRanges: Record<string, string> = {
    Q1: 'Jan-Mar',
    Q2: 'Apr-Jun',
    Q3: 'Jul-Sep',
    Q4: 'Oct-Dec',
  };
  const filterCards = [
    { id: 'all', label: t('themePreviewLab13All'), value: t('themePreviewLab13All') },
    { id: 'day', label: t('themePreviewLab13Day'), value: selectedDay },
    { id: 'month', label: t('themePreviewLab13Month'), value: `${selectedMonth} ${selectedYear}` },
    { id: 'quarter', label: t('themePreviewLab13Quarter'), value: `${selectedQuarter} · ${quarterRanges[selectedQuarter]}` },
    { id: 'year', label: t('themePreviewLab13Year'), value: selectedYear },
    { id: 'range', label: t('themePreviewLab13Range'), value: `${rangeStart} - ${rangeEnd}` },
  ];

  function chooseMode(mode: string) {
    setActive(mode);
    setPanelOpen(mode !== 'all');
  }

  return (
    <div className="nx-shad-filter-lab" dir="rtl">
      <div className="nx-shad-filter-concept nx-shad-filter-concept--compact">
        <div className="nx-shad-filter-sample__head">
          <div>
            <div className="nx-shad-filter-sample__title">01 · الشريط الذكي</div>
            <div className="nx-shad-filter-sample__hint">Segmented toolbar + محرر للفترة المختارة</div>
          </div>
          <span className="nx-shad-filter-badge">Compact</span>
        </div>

        <div className="nx-shad-filter-toolbar" role="group" aria-label={t('themePreviewLab13Title')}>
          {modes.map((mode) => (
            <Button
              key={mode.id}
              type="button"
              variant="raw"
              className={`nx-shad-filter-segment${active === mode.id ? ' nx-shad-filter-segment--active' : ''}`}
              aria-pressed={active === mode.id}
              onClick={() => chooseMode(mode.id)}
            >
              {mode.label}
            </Button>
          ))}
        </div>

        <div className="nx-shad-filter-value-row">
          <div className="nx-shad-filter-value">
            <span className="nx-shad-filter-value__label">{t('themePreviewLab13Period')}</span>
            <strong>{periodLabel}</strong>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="nx-shad-filter-clear"
            onClick={() => {
              setActive('month');
              setSelectedDay('2026-07-04');
              setRangeStart('2026-07-01');
              setRangeEnd('2026-07-31');
              setSelectedMonth('Jul');
              setSelectedYear('2026');
              setSelectedQuarter('Q3');
              setPanelOpen(true);
            }}
          >
            {t('themePreviewLab13Reset')}
          </Button>
        </div>

        {panelOpen && (
          <div className="nx-shad-filter-panel">
            <div className="nx-shad-filter-panel__head">
              <span>{activeLabel}</span>
              <strong>{periodLabel}</strong>
            </div>

            {active === 'day' && (
              <div className="nx-shad-filter-panel__field">
                <DateField label={t('themePreviewLab13Day')} value={selectedDay} onValueChange={setSelectedDay} />
              </div>
            )}

            {active === 'month' && (
              <div className="nx-shad-month-grid">
                {months.map((month) => (
                  <Button
                    key={month}
                    type="button"
                    variant="raw"
                    className={`nx-shad-month-cell${selectedMonth === month ? ' nx-shad-month-cell--active' : ''}`}
                    onClick={() => setSelectedMonth(month)}
                  >
                    {month}
                  </Button>
                ))}
              </div>
            )}

            {active === 'quarter' && (
              <div className="nx-shad-quarter-grid">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => (
                  <Button
                    key={quarter}
                    type="button"
                    variant="raw"
                    className={`nx-shad-quarter-cell${selectedQuarter === quarter ? ' nx-shad-quarter-cell--active' : ''}`}
                    onClick={() => setSelectedQuarter(quarter)}
                  >
                    <span>{quarter}</span>
                    <small>{quarterRanges[quarter]}</small>
                  </Button>
                ))}
              </div>
            )}

            {active === 'year' && (
              <div className="nx-shad-year-grid">
                {years.map((year) => (
                  <Button
                    key={year}
                    type="button"
                    variant="raw"
                    className={`nx-shad-year-cell${selectedYear === year ? ' nx-shad-year-cell--active' : ''}`}
                    onClick={() => setSelectedYear(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            )}

            {active === 'range' && (
              <div className="nx-shad-range-grid">
                <DateField label={t('dateFilterFrom')} value={rangeStart} onValueChange={setRangeStart} />
                <DateField label={t('dateFilterTo')} value={rangeEnd} min={rangeStart} onValueChange={setRangeEnd} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="nx-shad-filter-concept nx-shad-filter-concept--tiles">
        <div className="nx-shad-filter-sample__head">
          <div>
            <div className="nx-shad-filter-sample__title">02 · لوحة البطاقات</div>
            <div className="nx-shad-filter-sample__hint">كل نوع فلتر كبطاقة اختيار مستقلة</div>
          </div>
          <span className="nx-shad-filter-badge">Cards</span>
        </div>
        <div className="nx-shad-filter-mode-grid" aria-label={t('themePreviewLab13ChoosePeriod')}>
        {filterCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`nx-shad-filter-mode-card${active === card.id ? ' nx-shad-filter-mode-card--active' : ''}`}
            onClick={() => chooseMode(card.id)}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </button>
        ))}
        </div>
      </div>

      <div className="nx-shad-filter-grid">
        <div className="nx-shad-filter-concept nx-shad-filter-concept--command">
          <div className="nx-shad-filter-sample__head">
            <div>
              <div className="nx-shad-filter-sample__title">03 · قائمة الأوامر</div>
              <div className="nx-shad-filter-sample__hint">قائمة جانبية تشبه command palette مع معاينة حية</div>
            </div>
            <span className="nx-shad-filter-badge">Command</span>
          </div>
          <div className="nx-shad-command-layout">
            <div className="nx-shad-command-list">
              {filterCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`nx-shad-command-item${active === card.id ? ' nx-shad-command-item--active' : ''}`}
                  onClick={() => chooseMode(card.id)}
                >
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </button>
              ))}
            </div>
            <div className="nx-shad-command-preview">
              <span>{activeLabel}</span>
              <strong>{periodLabel}</strong>
              <div className="nx-shad-quarter-grid">
                {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => (
                  <Button
                    key={quarter}
                    type="button"
                    variant="raw"
                    className={`nx-shad-quarter-cell${quarter === selectedQuarter ? ' nx-shad-quarter-cell--active' : ''}`}
                    onClick={() => {
                      setActive('quarter');
                      setSelectedQuarter(quarter);
                      setPanelOpen(true);
                    }}
                  >
                    <span>{quarter}</span>
                    <small>{quarterRanges[quarter]}</small>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="nx-shad-filter-concept nx-shad-filter-concept--mobile">
          <div className="nx-shad-filter-sample__head">
            <div>
              <div className="nx-shad-filter-sample__title">04 · شيت الجوال</div>
              <div className="nx-shad-filter-sample__hint">قائمة bottom sheet مضغوطة لكل الأنواع</div>
            </div>
            <span className="nx-shad-filter-badge">Mobile</span>
          </div>
          <div className="nx-shad-mobile-preview">
            <div className="nx-shad-mobile-preview__handle" />
            <div className="nx-shad-mobile-preview__title">{t('themePreviewLab13MobileTitle')}</div>
            {filterCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`nx-shad-mobile-option${active === card.id ? ' nx-shad-mobile-option--active' : ''}`}
                onClick={() => chooseMode(card.id)}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </button>
            ))}
            <Button type="button" variant="primary" size="sm" className="w-full" onClick={() => setPanelOpen(false)}>
              {t('themePreviewLab13Apply')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
