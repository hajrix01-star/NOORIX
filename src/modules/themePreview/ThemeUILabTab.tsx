/** UI lab: each block has a stable ref number for “jump to block N”. */
import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DateField,
  Divider,
  Input,
  KebabMenu,
  Modal,
  ScreenTabs,
  SmartTable,
} from '../../ui';
import { useTranslation } from '../../i18n/useTranslation';

function LabBlock({ num, title, hint, children }: any) {
  return (
    <section
      id={`ui-lab-${num}`}
      className="noorix-surface-card overflow-hidden scroll-mt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-noorix-bg-muted/60 px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="shrink-0 flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg bg-noorix-blue text-[14px] font-extrabold text-white tabular-nums"
            aria-hidden
          >
            {num}
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-noorix-text m-0">{title}</h3>
            {hint ? <p className="text-[12px] text-noorix-muted m-0 mt-0.5">{hint}</p> : null}
          </div>
        </div>
        <code className="text-[11px] text-noorix-muted ltr font-mono shrink-0">ref #{num}</code>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const TABLE_ROWS = [
  { id: '1', name: 'عنصر أ', qty: 2, price: '100.00' },
  { id: '2', name: 'عنصر ب', qty: 1, price: '250.50' },
];

export function ShadcnInspiredDateFilterSamples({ t }: { t: (key: string) => string }) {
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

/** Lab block 3 — tabs demo: one content area per tab id */
const LAB3_DEMO_TAB_DEFS = [
  { id: 'a', labelKey: 'themePreviewLabDemoTabA', contentKey: 'themePreviewLab3ContentA' },
  { id: 'b', labelKey: 'themePreviewLabDemoTabB', contentKey: 'themePreviewLab3ContentB' },
  { id: 'c', labelKey: 'themePreviewLabDemoTabC', contentKey: 'themePreviewLab3ContentC' },
  { id: 'd', labelKey: 'themePreviewLabDemoTabD', contentKey: 'themePreviewLab3ContentD' },
  { id: 'e', labelKey: 'themePreviewLabDemoTabE', contentKey: 'themePreviewLab3ContentE' },
  { id: 'f', labelKey: 'themePreviewLabDemoTabF', contentKey: 'themePreviewLab3ContentF' },
  { id: 'g', labelKey: 'themePreviewLabDemoTabG', contentKey: 'themePreviewLab3ContentG' },
];

export default function ThemeUILabTab() {
  const { t } = useTranslation();
  const [demoTab, setDemoTab] = useState('a');
  const [modalOpen, setModalOpen] = useState(false);

  const demoTabItems = useMemo(
    () => LAB3_DEMO_TAB_DEFS.map((row: any) => ({ id: row.id, label: t(row.labelKey) })),
    [t],
  );

  const lab3ContentKey = useMemo(() => {
    const row = LAB3_DEMO_TAB_DEFS.find((x: any) => x.id === demoTab);
    return row?.contentKey ?? 'themePreviewLab3ContentA';
  }, [demoTab]);

  const tableColumns = useMemo(
    () => [
      { key: 'name', header: t('themePreviewLabColName'), sortable: true },
      { key: 'qty', header: t('themePreviewLabColQty'), sortable: true, className: 'ltr text-end' },
      { key: 'price', header: t('themePreviewLabColPrice'), sortable: false, className: 'ltr text-end' },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-noorix-muted m-0">{t('themePreviewUILabIntro')}</p>

      <LabBlock
        num={1}
        title={t('themePreviewLab1Title')}
        hint={t('themePreviewLab1Hint')}
      >
        <h2 className="text-[20px] font-bold text-noorix-text m-0">{t('themePreviewLab1SampleTitle')}</h2>
        <p className="text-[13px] text-noorix-muted m-0 mt-1">{t('themePreviewLab1SampleDesc')}</p>
      </LabBlock>

      <LabBlock
        num={2}
        title={t('themePreviewLab2Title')}
        hint={t('themePreviewLab2Hint')}
      >
        <div className="nx-page-header flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold text-noorix-text m-0">{t('themePreviewLab2PageTitle')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost">{t('themePreviewLab2Secondary')}</Button>
            <Button size="sm" variant="primary">{t('themePreviewLab2Primary')}</Button>
          </div>
        </div>
      </LabBlock>

      <LabBlock
        num={3}
        title={t('themePreviewLab3Title')}
        hint={t('themePreviewLab3Hint')}
      >
        <ScreenTabs
          items={demoTabItems}
          value={demoTab}
          onChange={setDemoTab}
          contentClassName="p-4"
        >
          <p className="text-[13px] text-noorix-muted m-0">{t(lab3ContentKey)}</p>
        </ScreenTabs>
      </LabBlock>

      <LabBlock
        num={4}
        title={t('themePreviewLab4Title')}
        hint={t('themePreviewLab4Hint')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary">{t('themePreviewLab4Primary')}</Button>
          <Button size="sm" variant="ghost">{t('themePreviewLab4Ghost')}</Button>
          <Button size="sm" variant="danger">{t('themePreviewLab4Danger')}</Button>
          <Button size="sm" variant="success">{t('themePreviewLab4Success')}</Button>
          <Button size="sm" variant="warning">{t('themePreviewLab4Warning')}</Button>
        </div>
      </LabBlock>

      <LabBlock
        num={5}
        title={t('themePreviewLab5Title')}
        hint={t('themePreviewLab5Hint')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input type="text" label={t('themePreviewLab5Text')} placeholder="…" />
          <Input type="number" label={t('themePreviewLab5Number')} />
          <DateField label={t('themePreviewLab5Date')} />
          <Input type="select" label={t('themePreviewLab5Select')}>
            <option value="">{t('themePreviewLab5SelectPh')}</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </Input>
        </div>
      </LabBlock>

      <LabBlock
        num={6}
        title={t('themePreviewLab6Title')}
        hint={t('themePreviewLab6Hint')}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="blue" size="sm">{t('themePreviewLab6Blue')}</Badge>
          <Badge color="green" size="sm">{t('themePreviewLab6Green')}</Badge>
          <Badge color="red" size="sm">{t('themePreviewLab6Red')}</Badge>
          <Badge color="amber" size="sm">{t('themePreviewLab6Amber')}</Badge>
        </div>
      </LabBlock>

      <LabBlock
        num={7}
        title={t('themePreviewLab7Title')}
        hint={t('themePreviewLab7Hint')}
      >
        <Divider />
        <p className="text-[13px] text-noorix-muted m-0">{t('themePreviewLab7AfterDivider')}</p>
      </LabBlock>

      <LabBlock
        num={8}
        title={t('themePreviewLab8Title')}
        hint={t('themePreviewLab8Hint')}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
            {t('themePreviewLab8Open')}
          </Button>
          <KebabMenu
            ariaLabel={t('themePreviewLab8MenuAria')}
            items={[
              { key: 'x', label: t('themePreviewLab8Item1'), onClick: () => {} },
              { key: 'y', label: t('themePreviewLab8Item2'), onClick: () => {} },
            ]}
          />
        </div>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('themePreviewLab8ModalTitle')} size="sm">
          <p className="text-[13px] text-noorix-text m-0">{t('themePreviewLab8ModalBody')}</p>
        </Modal>
      </LabBlock>

      <LabBlock
        num={9}
        title={t('themePreviewLab9Title')}
        hint={t('themePreviewLab9Hint')}
      >
        <SmartTable
          columns={tableColumns}
          data={TABLE_ROWS}
          total={TABLE_ROWS.length}
          page={1}
          pageSize={10}
          onPageChange={() => {}}
          title={t('themePreviewLab9TableTitle')}
          emptyMessage={t('themePreviewLab9Empty')}
        />
      </LabBlock>

      <LabBlock
        num={11}
        title={t('themePreviewLab11Title')}
        hint={t('themePreviewLab11Hint')}
      >
        <div className="flex flex-wrap gap-3">
          <div className="noorix-stat-card noorix-stat-card--green px-4 py-3 min-w-[140px]">
            <div className="noorix-stat-card__stripe" />
            <div className="noorix-stat-card__body">
              <div className="noorix-stat-card__label">{t('themePreviewLab11Label')}</div>
              <div className="noorix-stat-card__value text-[20px]">┘ة┘ث</div>
            </div>
          </div>
          <div className="noorix-stat-card noorix-stat-card--amber px-4 py-3 min-w-[140px]">
            <div className="noorix-stat-card__stripe" />
            <div className="noorix-stat-card__body">
              <div className="noorix-stat-card__label">{t('themePreviewLab11Label2')}</div>
              <div className="noorix-stat-card__value text-[20px]">┘ث</div>
            </div>
          </div>
        </div>
      </LabBlock>

      <LabBlock
        num={12}
        title={t('themePreviewLab12Title')}
        hint={t('themePreviewLab12Hint')}
      >
        <div className="noorix-surface-card nx-empty-state">
          {t('themePreviewLab12Empty')}
        </div>
      </LabBlock>

    </div>
  );
}
