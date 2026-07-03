import React from 'react';
import { Button, DateField } from '../../../ui';
import { FAQ_SECTION_ORDER } from '../smartChatFaq';
import type { SmartChatMobileToolsBodyProps } from '../types';

export function SmartChatMobileToolsBody({
  isAr,
  dateFilter,
  setDateFilter,
  t,
  filteredGroups,
  showFaq,
  visibleFaqQuestions,
  handleCommand,
  handleSend,
  onCloseSheet,
}: SmartChatMobileToolsBodyProps) {
  return (
    <div className="flex flex-col gap-3 pt-1 min-w-0" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="min-w-0 space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-noorix-muted">
          {t('chatFilterByDate')}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateField
            size="sm"
            className="noorix-smart-chat-date-input flex-1 min-w-0"
            value={dateFilter}
            onValueChange={(value) => setDateFilter(value || '')}
            lang="en"
            title={isAr ? 'تصفية بالتاريخ' : 'Filter by date'}
          />
          {dateFilter ? (
            <Button type="button" size="sm" className="shrink-0" onClick={() => setDateFilter('')}>
              {t('chatClearFilter')}
            </Button>
          ) : null}
        </div>
      </section>

      {filteredGroups.length > 0 ? (
        <div className="noorix-chat-commands-panel-content min-w-0 rounded-xl overflow-hidden border border-noorix-border">
          {filteredGroups.map((g) => (
            <div key={g.id} className="noorix-chat-commands-group">
              <div className="noorix-chat-commands-group-label">
                {g.icon} {isAr ? g.labelAr : g.labelEn}
              </div>
              <div className="noorix-chat-commands-grid">
                {g.items.map((it) => (
                  <Button
                    key={it.key}
                    type="button"
                    className="noorix-chat-commands-item noorix-chat-commands-item--compact"
                    onClick={() => {
                      handleCommand(it.key);
                      onCloseSheet();
                    }}
                  >
                    <span className="text-[15px] leading-none" aria-hidden>{it.icon}</span>
                    <span className="truncate text-[12px]">{isAr ? it.labelAr : it.labelEn}</span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showFaq ? (
        <div className="flex flex-col gap-1 pb-2 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted pb-1">
            {isAr ? 'أسئلة جاهزة' : 'Suggested questions'}
          </div>
          {FAQ_SECTION_ORDER.map((sec) => {
            const qs = visibleFaqQuestions.filter((q) => q.section === sec.id);
            if (!qs.length) return null;
            return (
              <div key={sec.id} className="min-w-0">
                <div className={`px-1 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-noorix-muted ${isAr ? 'text-right' : 'text-left'}`}>
                  {isAr ? sec.labelAr : sec.labelEn}
                </div>
                <div className="flex flex-col gap-1">
                  {qs.map((q, i) => (
                    <Button
                      key={`${sec.id}-${i}`}
                      type="button"
                      className={`w-full text-[12px] ${isAr ? 'justify-end text-right' : 'justify-start text-left'} py-2 px-3 font-medium leading-snug min-h-[36px] h-auto whitespace-normal`}
                      onClick={() => {
                        void handleSend(isAr ? q.ar : q.en);
                        onCloseSheet();
                      }}
                    >
                      {isAr ? (q.shortAr || q.ar) : (q.shortEn || q.en)}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
