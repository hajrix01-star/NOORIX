import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

/**
 * cn — دمج Tailwind classes بأمان (يحل تعارض الـ classes)
 * @param {...any} args
 * @returns {string}
 */
export function cn(...args) {
  return twMerge(clsx(args));
}
