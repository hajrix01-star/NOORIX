import React from 'react';
import { Button } from '../../../ui';
import { FAQ_SECTION_ORDER } from '../smartChatFaq';
import type { PermanentQuestion } from '../types';

export type SmartChatFaqListProps = {
  visibleFaqQuestions: PermanentQuestion[];
  isAr: boolean;
  onPickQuestion: (text: string) => void;
  className?: string;
  buttonClassName?: string;
  sectionHeaderClassName?: string;
};

export function SmartChatFaqList({
  visibleFaqQuestions,
  isAr,
  onPickQuestion,
  className = 'flex flex-col gap-1 pb-2',
  buttonClassName = 'w-full text-[14px] md:text-[15px] justify-start py-3 px-4 font-medium leading-snug',
  sectionHeaderClassName = 'px-1 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-noorix-muted',
}: SmartChatFaqListProps) {
  return (
    <div className={className}>
      {FAQ_SECTION_ORDER.map((sec) => {
        const qs = visibleFaqQuestions.filter((q) => q.section === sec.id);
        if (!qs.length) return null;
        return (
          <div key={sec.id} className="min-w-0">
            <div className={`${sectionHeaderClassName} ${isAr ? 'text-right' : 'text-left'}`}>
              {isAr ? sec.labelAr : sec.labelEn}
            </div>
            <div className="flex flex-col gap-2">
              {qs.map((q, i) => (
                <Button
                  key={`${sec.id}-${i}`}
                  className={`${buttonClassName} ${isAr ? 'text-right' : 'text-left'}`}
                  onClick={() => onPickQuestion(isAr ? q.ar : q.en)}
                >
                  {isAr ? (q.shortAr || q.ar) : (q.shortEn || q.en)}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
