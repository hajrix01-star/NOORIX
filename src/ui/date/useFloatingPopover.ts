import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';

export type FloatingPopoverOptions = {
  enabled?: boolean;
  maxWidth?: number;
  margin?: number;
  offset?: number;
};

export function useFloatingPopover({
  enabled = true,
  maxWidth = 360,
  margin = 14,
  offset = 8,
}: FloatingPopoverOptions = {}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open || !enabled) return;

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const rect = trigger.getBoundingClientRect();
      const width = Math.min(maxWidth, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, margin), window.innerWidth - width - margin);
      const viewportHeight = Math.max(0, window.innerHeight - margin * 2);
      const popoverHeight = Math.min(popover.getBoundingClientRect().height, viewportHeight);
      const availableBelow = Math.max(0, window.innerHeight - rect.bottom - offset - margin);
      const availableAbove = Math.max(0, rect.top - offset - margin);
      const placeAbove = popoverHeight > availableBelow && availableAbove > availableBelow;
      const availableHeight = placeAbove ? availableAbove : availableBelow;
      const maxHeight = Math.max(0, Math.min(viewportHeight, availableHeight));
      const top = placeAbove
        ? Math.max(margin, rect.top - offset - Math.min(popoverHeight, maxHeight))
        : Math.min(rect.bottom + offset, window.innerHeight - margin);

      setPopoverStyle({
        position: 'fixed',
        top,
        left,
        width,
        maxHeight,
        overflowY: 'auto',
      });
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [enabled, margin, maxWidth, offset, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return {
    triggerRef,
    popoverRef,
    open,
    setOpen,
    popoverStyle,
    closePopover: () => setOpen(false),
    togglePopover: () => setOpen((value) => !value),
  };
}
