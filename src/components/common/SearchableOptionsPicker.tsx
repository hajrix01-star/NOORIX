/**
 * SearchableOptionsPicker — قائمة منسدلة مع بحث؛ خيار واحد أو تعدد.
 * يُعرض القائمة عبر Portal لتجاوز overflow في الجداول.
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n/useTranslation';
import { Button, Input } from '../../ui';
import { cn } from '../../ui/cn';

export type SearchableOption = { value: string; label: string; disabled?: boolean };

const TRIGGER_BASE = [
  'w-full rounded-lg border border-noorix-border bg-noorix-surface text-noorix-text text-start',
  'focus:outline-none focus:border-noorix-blue focus:ring-1 focus:ring-noorix-blue/30',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'transition-colors duration-150 flex items-center justify-between gap-2',
].join(' ');

const SIZE_TRIGGER: Record<string, string> = {
  sm: 'h-7 px-2.5 text-[12px]',
  md: 'h-9 px-3 text-[13px]',
};

type CommonProps = {
  options: SearchableOption[];
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  size?: 'sm' | 'md';
  /** تسمية فوق الحقل (نماذج) */
  label?: React.ReactNode;
  /** نص الزر عند عدم اختيار شيء (متعدد) أو placeholder (واحد) */
  emptyLabel?: string;
  getOptionDisabled?: (opt: SearchableOption) => boolean;
};

export type SearchableOptionsPickerSingleProps = CommonProps & {
  mode?: 'single';
  value: string;
  onChange: (value: string) => void;
  /** قيمة «فارغة» مثل "" */
  allowEmpty?: boolean;
  emptyValue?: string;
};

export type SearchableOptionsPickerMultiProps = CommonProps & {
  mode: 'multiple';
  values: string[];
  onChange: (values: string[]) => void;
  showClearAll?: boolean;
};

export type SearchableOptionsPickerProps =
  | SearchableOptionsPickerSingleProps
  | SearchableOptionsPickerMultiProps;

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function SearchableOptionsPicker(props: SearchableOptionsPickerProps) {
  const { t, lang } = useTranslation();
  const isMulti = props.mode === 'multiple';
  const {
    options,
    className = '',
    disabled,
    id,
    'aria-label': ariaLabel,
    size = 'md',
    label,
    emptyLabel,
    getOptionDisabled,
  } = props;

  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 280, maxHeight: 320 });

  const valueById = useMemo(() => {
    const m = new Map<string, SearchableOption>();
    for (const o of options) m.set(o.value, o);
    return m;
  }, [options]);

  const selectedSingle = !isMulti ? (props as SearchableOptionsPickerSingleProps).value : '';
  const selectedMulti = isMulti ? (props as SearchableOptionsPickerMultiProps).values : [];

  const triggerText = useMemo(() => {
    const empty = emptyLabel ?? '';
    if (isMulti) {
      const vals = selectedMulti;
      if (!vals.length) return empty;
      if (vals.length === 1) {
        return valueById.get(vals[0])?.label ?? vals[0];
      }
      return t('dropdownSelectedCount', String(vals.length));
    }
    const ev = (props as SearchableOptionsPickerSingleProps).emptyValue ?? '';
    if ((props as SearchableOptionsPickerSingleProps).allowEmpty && selectedSingle === ev) {
      return empty;
    }
    return valueById.get(selectedSingle)?.label ?? (selectedSingle ? selectedSingle : empty);
  }, [emptyLabel, isMulti, props, selectedMulti, selectedSingle, t, valueById]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => norm(o.label).includes(q) || norm(o.value).includes(q));
  }, [options, query]);

  const updateMenuPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxH = 340;
    const gap = 4;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
    const width = Math.min(Math.max(rect.width, 200), vw - 16);
    let left = rect.left;
    if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
    let top: number;
    let effectiveMaxH = maxH;
    if (openUpward) {
      effectiveMaxH = Math.min(maxH, spaceAbove - 8);
      top = rect.top - gap - effectiveMaxH;
      if (top < 8) {
        top = 8;
        effectiveMaxH = Math.min(maxH, rect.top - gap - 8);
      }
    } else {
      top = rect.bottom + gap;
      effectiveMaxH = Math.min(maxH, spaceBelow - 8);
    }
    setMenuPos({ top, left, width, maxHeight: Math.max(120, effectiveMaxH) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onScroll = () => updateMenuPosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updateMenuPosition, filtered.length, query]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: Event) => {
      const a = anchorRef.current;
      const m = menuRef.current;
      const target = e.target instanceof Node ? e.target : null;
      if (!target) return;
      if (a?.contains(target) || m?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggleMulti = (val: string) => {
    if (!isMulti) return;
    const { values, onChange } = props as SearchableOptionsPickerMultiProps;
    const set = new Set(values);
    if (set.has(val)) set.delete(val);
    else set.add(val);
    onChange([...set]);
  };

  const selectSingle = (val: string) => {
    if (isMulti) return;
    const { onChange } = props as SearchableOptionsPickerSingleProps;
    onChange(val);
    setOpen(false);
  };

  const clearAllMulti = () => {
    if (!isMulti) return;
    (props as SearchableOptionsPickerMultiProps).onChange([]);
  };

  const searchPh = t('dropdownSearchPlaceholder');
  const openListAria = ariaLabel || t('dropdownOpenAria');

  const singleAllowEmpty = !isMulti && (props as SearchableOptionsPickerSingleProps).allowEmpty;
  const singleEmptyValue = !isMulti ? ((props as SearchableOptionsPickerSingleProps).emptyValue ?? '') : '';

  const menuContent =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-multiselectable={isMulti || undefined}
            className="fixed z-[10060] flex flex-col overflow-hidden rounded-[10px] border border-noorix-border bg-noorix-surface shadow-lg"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
            }}
          >
            <div className="shrink-0 border-b border-noorix-border p-2">
              <Input
                type="search"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder={searchPh}
                size={size === 'sm' ? 'sm' : 'md'}
                autoComplete="off"
                aria-label={searchPh}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.stopPropagation()}
              />
            </div>
            {isMulti && (props as SearchableOptionsPickerMultiProps).showClearAll && selectedMulti.length > 0 && (
              <div className="shrink-0 border-b border-noorix-border px-2 py-1">
                <Button type="button" size="sm" variant="ghost" className="w-full justify-center" onClick={clearAllMulti}>
                  {t('dropdownClearAll')}
                </Button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {!isMulti && singleAllowEmpty && (!norm(query) || norm(emptyLabel || '').includes(norm(query))) && (
                <Button
                  type="button"
                  role="option"
                  aria-selected={selectedSingle === singleEmptyValue}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSingle(singleEmptyValue)}
                  className={cn(
                    'nx-supplier-option w-full justify-start rounded-none font-normal',
                    selectedSingle === singleEmptyValue && 'bg-[var(--noorix-blue-8)]',
                  )}
                >
                  {emptyLabel ?? '—'}
                </Button>
              )}
              {filtered.length === 0 && (isMulti || !singleAllowEmpty || norm(query)) ? (
                <div className="px-3 py-2 text-[13px] text-noorix-muted">{lang === 'en' ? 'No matches' : 'لا نتائج'}</div>
              ) : (
                filtered.map((opt) => {
                  const dis = opt.disabled || getOptionDisabled?.(opt);
                  const checked = isMulti && selectedMulti.includes(opt.value);
                  const selectedOne = !isMulti && opt.value === selectedSingle;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isMulti ? checked : selectedOne}
                      disabled={dis}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (dis) return;
                        if (isMulti) toggleMulti(opt.value);
                        else selectSingle(opt.value);
                      }}
                      className={cn(
                        'nx-supplier-option w-full justify-start rounded-none font-normal',
                        (isMulti ? checked : selectedOne) && 'bg-[var(--noorix-blue-8)]',
                      )}
                    >
                      {isMulti && (
                        <span className="me-2 inline-flex w-4 shrink-0 justify-center" aria-hidden>
                          <input type="checkbox" readOnly checked={checked} className="pointer-events-none" tabIndex={-1} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-start">{opt.label}</span>
                    </Button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  const trigger = (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={openListAria}
      onClick={() => !disabled && setOpen((o) => !o)}
      className={cn(TRIGGER_BASE, SIZE_TRIGGER[size] ?? SIZE_TRIGGER.md, className)}
    >
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{triggerText}</span>
      <span className="shrink-0 text-noorix-muted text-[11px]" aria-hidden>
        ▼
      </span>
    </button>
  );

  return (
    <div className="relative min-w-0 w-full">
      {label ? (
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-noorix-text">{label}</span>
          <div ref={anchorRef}>{trigger}</div>
        </div>
      ) : (
        <div ref={anchorRef}>{trigger}</div>
      )}
      {menuContent}
    </div>
  );
}
