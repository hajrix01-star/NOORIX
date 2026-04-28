import React from 'react';

export type SmartChatEmptyStateProps = {
  narrow: boolean;
  isAr: boolean;
};

export function SmartChatEmptyState({ narrow, isAr }: SmartChatEmptyStateProps) {
  return (
    <div className="flex-1 min-w-0 flex flex-col text-noorix-muted text-center gap-4 justify-center items-center p-8">
      <div className="text-noorix-accent-blue opacity-[0.22]" aria-hidden>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <div className="text-[15px] max-w-[min(360px,92vw)] leading-[1.7] opacity-70 px-1">
        {isAr
          ? narrow
            ? 'افتح «أدوات» للفلتر والأوامر والأسئلة الجاهزة، أو اكتب سؤالك هنا.'
            : 'استخدم «الأوامر» لإدخال البيانات، أو «أسئلة جاهزة» للاستفسار، أو اكتب سؤالك مباشرة.'
          : narrow
            ? 'Open Tools for filters, commands, and suggested questions, or type below.'
            : 'Use Commands to enter data, Suggested for queries, or type your question below.'}
      </div>
    </div>
  );
}
