/**
 * SupplierSelect — بحث + قائمة منسدلة تُعرض عبر Portal لتجاوز overflow:hidden في جداول ERP
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
import { Input, Button } from '../../ui';
import { SUPPLIER_USAGE_KEY } from '../../constants/storageKeys';
import { readJsonStorage, writeJsonStorage } from '../../utils/jsonStorage';

function supplierLabel(supplier, lang = 'ar') {
  if (lang === 'en') return supplier?.nameEn || supplier?.nameAr || supplier?.id || '';
  return supplier?.nameAr || supplier?.nameEn || supplier?.id || '';
}

function readSupplierUsage() {
  const parsed = readJsonStorage(SUPPLIER_USAGE_KEY, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function trackSupplierUsage(supplierId) {
  if (!supplierId) return;
  const usage = readSupplierUsage();
  usage[supplierId] = Number(usage[supplierId] || 0) + 1;
  writeJsonStorage(SUPPLIER_USAGE_KEY, usage);
}

function matchesQuery(s, normalized) {
  if (!normalized) return true;
  return (
    String(s.nameAr || '').toLowerCase().includes(normalized) ||
    String(s.nameEn || '').toLowerCase().includes(normalized) ||
    String(s.code   || '').toLowerCase().includes(normalized)
  );
}

export function SupplierSelect({
  suppliers = [],
  value,
  onChange,
  bookmarkedIds = [],
  placeholder = '—',
  /** يُمرَّر لحقل البحث الداخلي — ربط تسمية النموذج العمودي */
  id,
}) {
  const { lang } = useTranslation();
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [usageVersion, setUsageVersion] = useState(0);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 280, maxHeight: 320 });

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === value) || null,
    [suppliers, value],
  );

  useEffect(() => {
    if (!open) {
      setQuery(selectedSupplier ? supplierLabel(selectedSupplier, lang) : '');
    }
  }, [selectedSupplier, open, lang]);

  /* ── ثلاثة أقسام: مفضلة → أكثر استخداماً → باقي ── */
  const { favoritesSection, mostUsedSection, regularSection } = useMemo(() => {
    const usage = readSupplierUsage();
    const normalized = query.trim().toLowerCase();
    const bookmarked = new Set(bookmarkedIds);
    const localeOpts = lang === 'en' ? 'en' : 'ar';

    const favorites = [];
    const mostUsed  = [];
    const regular   = [];

    for (const s of suppliers) {
      if (!matchesQuery(s, normalized)) continue;
      if (bookmarked.has(s.id)) {
        favorites.push(s);
      } else if (Number(usage[s.id] || 0) > 0) {
        mostUsed.push(s);
      } else {
        regular.push(s);
      }
    }

    favorites.sort((a, b) =>
      supplierLabel(a, lang).localeCompare(supplierLabel(b, lang), localeOpts),
    );
    mostUsed.sort((a, b) =>
      Number(usage[b.id] || 0) - Number(usage[a.id] || 0),
    );
    regular.sort((a, b) =>
      supplierLabel(a, lang).localeCompare(supplierLabel(b, lang), localeOpts),
    );

    return {
      favoritesSection: favorites,
      mostUsedSection:  mostUsed.slice(0, 10),
      regularSection:   regular.slice(0, 30),
    };
  }, [bookmarkedIds, query, suppliers, lang, usageVersion]);

  const totalVisible = favoritesSection.length + mostUsedSection.length + regularSection.length;

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
    const width = Math.min(Math.max(rect.width, 220), vw - 16);
    let left = rect.left;
    if (left + width > vw - 8) left = Math.max(8, vw - 8 - width);
    let top;
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
  }, [open, updateMenuPosition, query, totalVisible, usageVersion]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const a = anchorRef.current;
      const m = menuRef.current;
      if (a?.contains(e.target) || m?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const showMenu = open && (totalVisible > 0 || query.trim() || suppliers.length > 0);

  function selectSupplier(supplier) {
    onChange(supplier.id);
    setQuery(supplierLabel(supplier));
    setOpen(false);
    trackSupplierUsage(supplier.id);
    setUsageVersion((v) => v + 1);
  }

  const ph = placeholder && placeholder !== '—' ? placeholder : 'ابحث عن المورد أو اختره';

  const menuContent = showMenu && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="fixed overflow-y-auto rounded-[10px] border border-noorix-border bg-noorix-surface"
          style={{
            zIndex: 10060,
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          }}
        >
          {/* ── قسم المفضلة ── */}
          {favoritesSection.length > 0 && (
            <>
              <div className="pt-2 px-3 pb-1.5 text-[11px] font-bold text-noorix-amber bg-noorix-bg border-b border-noorix-border">
                ★ المفضلة
              </div>
              {favoritesSection.map((s) => (
                <Button
                  key={`fav-${s.id}`}
                  role="option"
                  aria-selected={s.id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSupplier(s)}
                  className="nx-supplier-option"
                  style={s.id === value ? { background: 'var(--noorix-blue-8)' } : undefined}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {supplierLabel(s, lang)}
                  </span>
                  <span className="shrink-0 text-noorix-amber text-[13px]">★</span>
                </Button>
              ))}
            </>
          )}

          {/* ── قسم الأكثر استخداماً ── */}
          {mostUsedSection.length > 0 && (
            <>
              <div className="pt-2 px-3 pb-1.5 text-[11px] font-bold text-noorix-muted bg-noorix-bg border-b border-noorix-border">
                الأكثر استخداماً
              </div>
              {mostUsedSection.map((s) => (
                <Button
                  key={`used-${s.id}`}
                  role="option"
                  aria-selected={s.id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSupplier(s)}
                  className="nx-supplier-option"
                  style={s.id === value ? { background: 'var(--noorix-blue-8)' } : undefined}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {supplierLabel(s, lang)}
                  </span>
                  <span className="text-[11px] text-noorix-blue shrink-0">الأكثر</span>
                </Button>
              ))}
            </>
          )}

          {/* ── قسم باقي الموردين ── */}
          {regularSection.length > 0 && (
            <>
              {(favoritesSection.length > 0 || mostUsedSection.length > 0) && (
                <div className="pt-2 px-3 pb-1.5 text-[11px] font-bold text-noorix-muted bg-noorix-bg border-b border-noorix-border">
                  جميع الموردين
                </div>
              )}
              {regularSection.map((s) => (
                <Button
                  key={s.id}
                  role="option"
                  aria-selected={s.id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSupplier(s)}
                  className="nx-supplier-option"
                  style={s.id === value ? { background: 'var(--noorix-blue-8)' } : undefined}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {supplierLabel(s, lang)}
                  </span>
                </Button>
              ))}
            </>
          )}

          {/* ── لا نتائج ── */}
          {totalVisible === 0 && (
            <div className="py-[10px] px-3 text-[13px] text-noorix-muted">
              {suppliers.length ? 'لا يوجد مورد مطابق' : 'لا يوجد موردون متاحون حالياً'}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative" ref={anchorRef}>
      <Input
        id={id}
        value={query}
        onFocus={() => { setOpen(true); }}
        onClick={() => { setOpen(true); }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (!next.trim() && value) onChange('');
        }}
        placeholder={ph}
        autoComplete="off"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="pe-9"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-3 text-noorix-muted text-[12px]"
      >
        ▼
      </span>
      {menuContent}
    </div>
  );
}
