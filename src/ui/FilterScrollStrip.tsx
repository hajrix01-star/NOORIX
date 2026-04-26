import React from 'react';
import { cn } from './cn';

/** غلاف تمرير أفقي مع تلاشي الحواف — مثل شريط الفلاتر التنفيذية في الفواتير */
export default function FilterScrollStrip({ children, className }) {
  return <div className={cn('relative nx-tab-bar-fade-wrap', className)}>{children}</div>;
}
