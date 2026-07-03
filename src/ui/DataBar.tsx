import React from 'react';
import { cn } from './cn';

export type DataBarProps = React.HTMLAttributes<HTMLDivElement> & {
  widthPercent?: number;
  heightPx?: number;
  color?: string;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export default function DataBar({
  widthPercent,
  heightPx,
  color,
  className,
  ...props
}: DataBarProps) {
  const style: React.CSSProperties = {
    width: widthPercent == null ? undefined : `${clampPercent(widthPercent)}%`,
    height: heightPx == null ? undefined : `${Math.max(0, heightPx)}px`,
    background: color || undefined,
  };

  return <div {...props} className={cn(className)} style={style} />;
}
