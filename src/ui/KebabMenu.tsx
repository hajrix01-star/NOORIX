/**
 * KebabMenu — زر ⋮ + قائمة منسدلة عبر Portal (موضع ذكي RTL/LTR، إغلاق بالنقر خارج)
 */
import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const KebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <circle cx="8" cy="4" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="12" r="1.5" />
  </svg>
);

const VIEWPORT_GAP = 10;
const ROW_HEIGHT = 42;
const MENU_PADDING = 12;

/**
 * @typedef {{ key: string; label: React.ReactNode; onClick: () => void; hidden?: boolean; style?: React.CSSProperties }} KebabMenuItem
 */

function KebabMenuInner({
  ariaLabel,
  items,
  menuWidth = 176,
  menuMaxHeight = 280,
  emptyFallback = null,
}) {
  const visible = (items || []).filter((x) => x && !x.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

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
    const handleClickOutside = (e) => {
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

  const menuContent = open && (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="nx-actions-menu"
      style={{ top: pos.top, maxHeight: menuMaxHeight, ...horizontalStyle }}
    >
      {visible.map((it) => (
        <Button
          key={it.key}
          role="menuitem"
          onClick={() => {
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
        onClick={() => setOpen((p) => !p)}
        className={`nx-actions-kebab${open ? ' nx-actions-kebab--open' : ''}`}
      >
        <KebabIcon />
      </Button>
      {menuContent && createPortal(menuContent, document.body)}
    </div>
  );
}

export const KebabMenu = memo(KebabMenuInner);
export default KebabMenu;
