import React from 'react';

/** غلاف التمرير لمحتوى الإدخال السريع — نفس البنية السابقة */
export function HrQuickEntryTable({
  dir,
  children,
}: {
  dir: 'rtl' | 'ltr';
  children: React.ReactNode;
}) {
  return (
    <div
      dir={dir}
      className="overflow-y-auto"
      style={{
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {children}
    </div>
  );
}
