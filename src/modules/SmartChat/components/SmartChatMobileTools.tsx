import React from 'react';
import { Button, Input } from '../../../ui';
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
    <div className="flex flex-col gap-5 pt-1 min-w-0" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="min-w-0 space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted">
          {t('chatFilterByDate')}
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          <Input
            type="date"
            className="noorix-smart-chat-date-input flex-1 min-w-0 min-h-[44px]"
            value={dateFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFilter(e.target.value || '')}
            lang="en"
            title={isAr ? 'تصفية بالتاريخ' : 'Filter by date'}
          />
          {dateFilter ? (
            <Button type="button" size="sm" className="shrink-0 min-h-[44px]" onClick={() => setDateFilter('')}>
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
              <div className={`noorix-chat-commands-grid${g.items.length === 1 ? ' noorix-chat-commands-grid--single' : ''}`}>
                {g.items.map((it) => (
                  <Button
                    key={it.key}
                    type="button"
                    className="noorix-chat-commands-item"
                    onClick={() => {
                      handleCommand(it.key);
                      onCloseSheet();
                    }}
                  >
                    <span aria-hidden>{it.icon}</span>
                    <span>{isAr ? it.labelAr : it.labelEn}</span>
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
                <div
                  className="px-1 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted"
                  style={{ textAlign: isAr ? 'right' : 'left' }}
                >
                  {isAr ? sec.labelAr : sec.labelEn}
                </div>
                <div className="flex flex-col gap-2">
                  {qs.map((q, i) => (
                    <Button
                      key={`${sec.id}-${i}`}
                      type="button"
                      className="w-full text-[14px] justify-start py-3 px-4 font-medium leading-snug min-h-[48px] h-auto whitespace-normal"
                      style={{ textAlign: isAr ? 'right' : 'left' }}
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
