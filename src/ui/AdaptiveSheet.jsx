/**
 * AdaptiveSheet — نماذج ومعالجات: Modal مركزي على الشاشات العريضة، Drawer على الضيقة.
 *
 * نقطة القطع الافتراضية 900px (أعرض من الجوال والتابلت العمودي ≈ سطح مكتب).
 * يستخدم useSyncExternalStore مع matchMedia لتفادي وميض التصيير ودعم تغيير حجم النافذة.
 */
import React, { useSyncExternalStore } from 'react';
import Modal from './Modal';
import Drawer from './Drawer';

/** عرض أقصى (بكسل) يُعتبر «ضيقاً» → Drawer */
export const ADAPTIVE_SHEET_BREAKPOINT_PX = 900;

function subscribeNarrow(breakpointPx, onStoreChange) {
  const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getNarrowSnapshot(breakpointPx) {
  return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
}

/** خطاف اختياري إن احتجت منطقاً مشروطاً خارج المكوّن */
export function useAdaptiveSheetNarrow(breakpointPx = ADAPTIVE_SHEET_BREAKPOINT_PX) {
  return useSyncExternalStore(
    (cb) => subscribeNarrow(breakpointPx, cb),
    () => getNarrowSnapshot(breakpointPx),
    () => getNarrowSnapshot(breakpointPx),
  );
}

function drawerSizeFromProp(size) {
  if (size === '2xl') return 'xl';
  return size;
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {()=>void} props.onClose
 * @param {string} [props.title]
 * @param {'sm'|'md'|'lg'|'xl'|'2xl'|'full'} [props.size='md']
 * @param {'default'|'danger'} [props.variant='default'] — يُطبَّق على فرع Modal فقط (`flush` عبر className على Modal إن لزم)
 * @param {React.ReactNode} [props.footer]
 * @param {boolean} [props.closeOnBackdrop=true]
 * @param {boolean} [props.hideClose=false]
 * @param {string} [props.className]
 * @param {'start'|'end'} [props.side='start'] — فرع Drawer فقط (RTL: start = يمين)
 * @param {number} [props.breakpointPx=900]
 * @param {React.ReactNode} props.children
 */
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
}) {
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
