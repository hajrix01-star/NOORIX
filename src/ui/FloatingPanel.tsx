import React from 'react';
import { cn } from './cn';

export type FloatingPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  top?: number;
  left?: number;
  width?: number | string;
  maxHeight?: number | string;
  zIndex?: number | string;
  boxShadow?: string;
  direction?: React.CSSProperties['direction'];
};

const sizeValue = (value: number | string | undefined) =>
  typeof value === 'number' ? `${value}px` : value;

const FloatingPanel = React.forwardRef<HTMLDivElement, FloatingPanelProps>(function FloatingPanel(
  {
    top,
    left,
    width,
    maxHeight,
    zIndex,
    boxShadow,
    direction,
    className,
    children,
    ...props
  },
  ref,
) {
  const style: React.CSSProperties = {
    position: 'fixed',
    top,
    left,
    width: sizeValue(width),
    maxHeight: sizeValue(maxHeight),
    zIndex,
    boxShadow,
    direction,
  };

  return (
    <div ref={ref} {...props} className={cn(className)} style={style}>
      {children}
    </div>
  );
});

export default FloatingPanel;
