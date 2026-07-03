import React from 'react';
import { cn } from './cn';

type RuntimeStyleBoxElement = 'div' | 'span';

export type RuntimeStyleBoxProps<TElement extends RuntimeStyleBoxElement = 'div'> =
  React.HTMLAttributes<TElement extends 'span' ? HTMLSpanElement : HTMLDivElement> & {
    as?: TElement;
    background?: string | null;
    border?: string | null;
    color?: string | null;
  };

export default function RuntimeStyleBox<TElement extends RuntimeStyleBoxElement = 'div'>({
  as,
  background,
  border,
  color,
  className,
  children,
  ...props
}: RuntimeStyleBoxProps<TElement>) {
  const Component = (as ?? 'div') as RuntimeStyleBoxElement;
  const style: React.CSSProperties = {
    background: background || undefined,
    border: border || undefined,
    color: color || undefined,
  };

  return (
    <Component
      {...(props as React.HTMLAttributes<HTMLSpanElement & HTMLDivElement>)}
      className={cn(className)}
      style={style}
    >
      {children}
    </Component>
  );
}
