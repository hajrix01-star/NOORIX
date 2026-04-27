/**
 * AdaptiveSheet — نماذج ومعالجات: Modal مركزي على الشاشات العريضة، Drawer على الضيقة.
 *
 * نقطة القطع الافتراضية 900px (أعرض من الجوال والتابلت العمودي ≈ سطح مكتب).
 * يستخدم useSyncExternalStore مع matchMedia لتفادي وميض التصيير ودعم تغيير حجم النافذة.
 */
import React, { useSyncExternalStore, type ReactNode } from 'react';
import Modal from './Modal';
import Drawer from './Drawer';

/** عرض أقصى (بكسل) يُعتبر «ضيقاً» → Drawer */
export const ADAPTIVE_SHEET_BREAKPOINT_PX = 900;

function subscribeNarrow(breakpointPx: any, onStoreChange: any) {
  const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getNarrowSnapshot(breakpointPx: any) {
  return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
}

/** خطاف اختياري إن احتجت منطقاً مشروطاً خارج المكوّن */
export function useAdaptiveSheetNarrow(breakpointPx: any = ADAPTIVE_SHEET_BREAKPOINT_PX) {
  return useSyncExternalStore(
    (cb: any) => subscribeNarrow(breakpointPx, cb),
    () => getNarrowSnapshot(breakpointPx),
    () => false,
  );
}

function drawerSizeFromProp(size: any) {
  if (size === '2xl') return 'xl';
  return size;
}

export type AdaptiveSheetProps = {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | string;
  variant?: 'default' | 'danger' | string;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
  hideClose?: boolean;
  className?: string;
  side?: 'start' | 'end' | 'bottom' | string;
  breakpointPx?: number;
  children?: ReactNode;
};

export default function AdaptiveSheet({
  open,
  onClose,
  title,
  size = 'md',
  variant = 'default',
  footer,
  closeOnBackdrop = true,
  hideClose = false,
  className = '',
  side = 'start',
  breakpointPx = ADAPTIVE_SHEET_BREAKPOINT_PX,
  children,
}: AdaptiveSheetProps) {
  const narrow = useAdaptiveSheetNarrow(breakpointPx);

  if (narrow) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title={title}
        size={drawerSizeFromProp(size)}
        side={side}
        footer={footer}
        closeOnBackdrop={closeOnBackdrop}
        hideClose={hideClose}
        className={className}
      >
        {children}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={size}
      variant={variant}
      footer={footer}
      closeOnBackdrop={closeOnBackdrop}
      hideClose={hideClose}
      className={className}
    >
      {children}
    </Modal>
  );
}
