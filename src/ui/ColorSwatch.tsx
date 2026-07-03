import React from 'react';
import { cn } from './cn';

type ColorSwatchElement = 'span' | 'div';

export type ColorSwatchProps<TElement extends ColorSwatchElement = 'span'> =
  React.HTMLAttributes<TElement extends 'div' ? HTMLDivElement : HTMLSpanElement> & {
    as?: TElement;
    color?: string | null;
    fallbackColor?: string;
    textColor?: string;
  };

export default function ColorSwatch<TElement extends ColorSwatchElement = 'span'>({
  as,
  color,
  fallbackColor = 'var(--noorix-border)',
  textColor,
  className,
  children,
  ...props
}: ColorSwatchProps<TElement>) {
  const Component = (as ?? 'span') as ColorSwatchElement;
  const style: React.CSSProperties = {
    background: color || fallbackColor,
    color: textColor || undefined,
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
