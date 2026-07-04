import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export type FloatingPopoverOptions = {
  maxWidth?: number;
  margin?: number;
  offset?: number;
};

export function useFloatingPopover({
  maxWidth = 360,
  margin = 14,
  offset = 8,
}: FloatingPopoverOptions = {}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => {
    if (!open) return;

    const updatePopoverPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = Math.min(maxWidth, window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, margin), window.innerWidth - width - margin);
      const top = Math.min(rect.bottom + offset, window.innerHeight - margin);

      setPopoverStyle({
        position: 'fixed',
        top,
        left,
        width,
      });
    };

    updatePopoverPosition();
    window.addEventListener('resize', updatePopoverPosition);
    window.addEventListener('scroll', updatePopoverPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopoverPosition);
      window.removeEventListener('scroll', updatePopoverPosition, true);
    };
  }, [margin, maxWidth, offset, open]);

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
