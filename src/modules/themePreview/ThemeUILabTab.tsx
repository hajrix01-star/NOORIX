/** UI lab: each block has a stable ref number for “jump to block N”. */
import React, { useMemo, useState } from 'react';
import { ShadcnInspiredDateFilterSamples } from './ThemeDateFilterSamples';
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
import {
  buildThemePreviewDemoTabs,
  buildThemePreviewTableColumns,
  getThemePreviewDemoContentKey,
  THEME_PREVIEW_TABLE_ROWS,
  type ThemePreviewLabBlockProps,
} from './themePreviewModel';

function LabBlock({ num, title, hint, children }: ThemePreviewLabBlockProps) {
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



export default function ThemeUILabTab() {
  const { t } = useTranslation();
  const [demoTab, setDemoTab] = useState('a');
  const [modalOpen, setModalOpen] = useState(false);

  const demoTabItems = useMemo(
    () => buildThemePreviewDemoTabs(t),
    [t],
  );

  const lab3ContentKey = useMemo(() => getThemePreviewDemoContentKey(demoTab), [demoTab]);

  const tableColumns = useMemo(
    () => buildThemePreviewTableColumns(t),
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
          data={THEME_PREVIEW_TABLE_ROWS}
          total={THEME_PREVIEW_TABLE_ROWS.length}
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
              <div className="noorix-stat-card__value text-[20px]">125</div>
            </div>
          </div>
          <div className="noorix-stat-card noorix-stat-card--amber px-4 py-3 min-w-[140px]">
            <div className="noorix-stat-card__stripe" />
            <div className="noorix-stat-card__body">
              <div className="noorix-stat-card__label">{t('themePreviewLab11Label2')}</div>
              <div className="noorix-stat-card__value text-[20px]">32</div>
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
