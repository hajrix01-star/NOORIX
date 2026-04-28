import React, { type ReactNode } from 'react';
import { ScreenTabs } from '../../../ui';

export function ImportExportTabs({
  items,
  value,
  onChange,
  children,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <ScreenTabs
      className="mb-4"
      fadeWrap={false}
      items={items}
      value={value}
      onChange={onChange}
      contentClassName="nx-tab-content p-1 sm:p-4"
      animateContent={false}
    >
      {children}
    </ScreenTabs>
  );
}
