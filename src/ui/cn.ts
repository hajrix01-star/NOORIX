import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';

/**
 * cn — دمج Tailwind classes بأمان (يحل تعارض الـ classes)
 */
export function cn(...args: ClassValue[]) {
  return twMerge(clsx(args));
}
