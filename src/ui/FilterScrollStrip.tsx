import React from 'react';
import { cn } from './cn';

/** غلاف تمرير أفقي مع تلاشي الحواف — مثل شريط الفلاتر التنفيذية في الفواتير */
type FilterScrollStripProps = {
  children?: React.ReactNode;
  className?: string;
};

export default function FilterScrollStrip({ children, className }: FilterScrollStripProps) {
  return <div className={cn('relative nx-tab-bar-fade-wrap', className)}>{children}</div>;
}
