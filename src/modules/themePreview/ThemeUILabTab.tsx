/**
 * ╪ز╪ذ┘ê┘è╪ذ ┘à╪╣╪▒╪╢ ╪د┘┘à┘â┘ê┘ّ┘╪د╪ز ظ¤ ┘â┘ ╪ذ┘┘ê┘â ┘┘ç ╪▒┘é┘à ╪س╪د╪ذ╪ز ┘┘┘à╪▒╪ش╪╣┘è╪ر ╪╣┘╪» ╪╖┘╪ذ ┬س┘┘┘ّ╪░ ┘à╪س┘ ╪▒┘é┘à N┬╗.
 */
import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Input,
  KebabMenu,
  Modal,
  ScreenTabs,
  SmartTable,
} from '../../ui';
import DateFilterBar, { useDateFilter } from '../../shared/components/DateFilterBar';
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
  { id: '1', name: '╪╣┘╪╡╪▒ ╪ث', qty: 2, price: '100.00' },
  { id: '2', name: '╪╣┘╪╡╪▒ ╪ذ', qty: 1, price: '250.50' },
];

/** ┘à╪▒╪ش╪╣ ╪▒┘é┘à 3 ظ¤ ╪ز╪ذ┘ê┘è╪ذ╪د╪ز ╪د┘╪ز╪ش╪▒╪ذ╪ر: ┘à┘╪ز╪د╪ص ┘à╪ص╪ز┘ê┘ë ┘┘â┘ id */
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
  const dateFilter = useDateFilter();
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
          <Input type="text" label={t('themePreviewLab5Text')} placeholder="ظخ" />
          <Input type="number" label={t('themePreviewLab5Number')} />
          <Input type="date" label={t('themePreviewLab5Date')} />
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
        num={10}
        title={t('themePreviewLab10Title')}
        hint={t('themePreviewLab10Hint')}
      >
        <DateFilterBar filter={dateFilter} />
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
