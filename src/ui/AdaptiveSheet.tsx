import React, { type ReactNode } from 'react';
import Drawer from './Drawer';
import Modal from './Modal';
import { NOORIX_BREAKPOINTS, useAdaptiveSheetNarrow } from './responsive';

export const ADAPTIVE_SHEET_BREAKPOINT_PX = NOORIX_BREAKPOINTS.adaptiveSheet;

function drawerSizeFromProp(size: AdaptiveSheetProps['size']) {
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
