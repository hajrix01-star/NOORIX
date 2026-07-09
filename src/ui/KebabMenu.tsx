/**
 * KebabMenu — زر إجراءات موحد + قائمة منسدلة عبر Portal.
 */
import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const ActionsMenuIcon = () => (
  <svg className="nx-actions-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3.25 4.25h9.5M3.25 8h9.5M3.25 11.75h5.25"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <path
      d="M10.25 11.35l1.05 1.05 2-2"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VIEWPORT_GAP = 10;
const ROW_HEIGHT = 42;
const MENU_PADDING = 12;

export type KebabMenuItem = {
  key: string;
  label: React.ReactNode;
  onClick?: () => void;
  hidden?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
};

export type KebabMenuProps = {
  ariaLabel: string;
  items?: Array<KebabMenuItem | null | undefined | false>;
  menuWidth?: number;
  menuMaxHeight?: number;
  emptyFallback?: React.ReactNode;
  buttonClassName?: string;
};

function KebabMenuInner({
  ariaLabel,
  items,
  menuWidth = 176,
  menuMaxHeight = 280,
  emptyFallback = null,
  buttonClassName = '',
}: KebabMenuProps) {
  const visible = (items || []).filter((item): item is KebabMenuItem => Boolean(item && !item.hidden));
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const estimatedHeight = Math.min(menuMaxHeight, Math.max(1, visible.length) * ROW_HEIGHT + MENU_PADDING);
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openUpward = spaceBelow < estimatedHeight + VIEWPORT_GAP && spaceAbove > spaceBelow;
    const top = openUpward
      ? Math.max(VIEWPORT_GAP, r.top - estimatedHeight - 4)
      : Math.min(window.innerHeight - estimatedHeight - VIEWPORT_GAP, r.bottom + 4);
    const safeLeft = Math.min(
      Math.max(VIEWPORT_GAP, r.left),
      Math.max(VIEWPORT_GAP, window.innerWidth - menuWidth - VIEWPORT_GAP),
    );
    setPos({ top, left: safeLeft });
  }, [open, visible.length, menuMaxHeight, menuWidth]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (
        btnRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (visible.length === 0) {
    return emptyFallback;
  }

  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const horizontalStyle = isRtl
    ? { right: Math.max(VIEWPORT_GAP, window.innerWidth - pos.left - menuWidth) }
    : { left: pos.left };
  const menuStyle = { top: pos.top, maxHeight: menuMaxHeight, ...horizontalStyle };

  const menuContent = open && (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="nx-actions-menu"
      style={menuStyle}
    >
      {visible.map((it) => (
        <Button
          key={it.key}
          role="menuitem"
          disabled={it.disabled}
          onClick={() => {
            if (it.disabled) return;
            setOpen(false);
            it.onClick?.();
          }}
          className="nx-actions-menu-item"
          style={it.style}
        >
          {it.label}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="relative inline-flex">
      <Button
        ref={btnRef}
        variant="raw"
        size="auto"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
        title={typeof ariaLabel === 'string' ? ariaLabel : undefined}
        onClick={() => setOpen((p) => !p)}
        className={`nx-actions-kebab${open ? ' nx-actions-kebab--open' : ''}${buttonClassName ? ` ${buttonClassName}` : ''}`}
      >
        <ActionsMenuIcon />
      </Button>
      {menuContent && createPortal(menuContent, document.body)}
    </div>
  );
}

export const KebabMenu = memo(KebabMenuInner);
export default KebabMenu;
