import React, { memo, useState, useRef, useEffect } from 'react';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS, TYPE_COLORS } from '../constants/treasuryConstants';
import { Badge, Button } from '../../../ui';

/* ── استخراج بيانات النوع المخصص من قيمة type ─────────────── */
export function parseVaultType(type) {
  if (typeof type === 'string' && type.startsWith('custom:')) {
    const emoji = type.slice(7) || 'خ';
    return { isCustom: true, emoji };
  }
  return { isCustom: false, emoji: null };
}

/* ── أيقونات SVG (مشتركة مع نموذج الخزينة) ─────────────────── */
export const VAULT_TYPE_SVGS = {
  cash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <rect x="2" y="6" width="20" height="12" rx="2"/>
      <circle cx="12" cy="12" r="2.5"/>
      <path d="M6 12h.01M18 12h.01"/>
    </svg>
  ),
  bank: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <path d="M3 9l9-7 9 7"/>
      <rect x="4" y="9" width="3" height="9"/>
      <rect x="10.5" y="9" width="3" height="9"/>
      <rect x="17" y="9" width="3" height="9"/>
      <line x1="2" y1="18" x2="22" y2="18"/>
    </svg>
  ),
  app: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
};

/* ── قائمة الإجراءات — position:absolute لتجنب مشاكل fixed مع overflow ─── */
function ActionMenu({ vault, onEdit, onToggleSalesChannel, onTogglePaymentMethod, onArchive, onDelete, t, lang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isArchived = vault.isArchived;
  const isRtl = lang !== 'en';

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('touchstart', handler, true);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('touchstart', handler, true);
    };
  }, [open]);

  const paymentOn = vault.showAsPaymentMethod !== false;
  const items = [
    { label: t('edit'),    action: () => { onEdit(vault); setOpen(false); }, color: 'var(--noorix-text)' },
    { label: vault.isSalesChannel ? t('salesChannelEnabled') : t('salesChannel'),
      action: () => { onToggleSalesChannel(vault); setOpen(false); }, color: 'var(--noorix-accent-green)' },
    { label: paymentOn ? t('hidePaymentMethodOption') : t('showPaymentMethodOption'),
      action: () => { onTogglePaymentMethod(vault); setOpen(false); }, color: 'var(--noorix-accent-blue)' },
    { label: isArchived ? t('restore') : t('archive'),
      action: () => { onArchive(vault); setOpen(false); }, color: 'var(--noorix-accent-amber)' },
    { label: t('delete'), action: () => { onDelete(vault); setOpen(false); }, color: 'var(--noorix-accent-red)' },
  ];

  return (
    <div
      ref={ref}
      className="relative"
      style={{ zIndex: 10 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        className="vault-card-menu-btn w-9 h-9 rounded-[10px] shrink-0"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          background: open ? 'var(--noorix-bg-muted)' : 'transparent',
        }}
        title={t('actions')}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <circle cx="4" cy="10" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="16" cy="10" r="1.8"/>
        </svg>
      </Button>

      {open && (
        <div
          className="bg-noorix-surface border border-noorix-border rounded-xl absolute py-1.5 min-w-[160px] max-w-[220px]"
          style={{
            top: 'calc(100% + 4px)',
            ...(isRtl ? { left: 0 } : { right: 0 }),
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            width: 'max-content',
            direction: isRtl ? 'rtl' : 'ltr',
            zIndex: 100,
          }}
        >
          {items.map(({ label, action, color }) => (
            <Button
              key={label}
              variant="ghost"
              className="vault-card-action-item w-full text-[13px] block py-[10px] px-4 whitespace-nowrap"
              onClick={action}
              style={{
                textAlign: isRtl ? 'right' : 'left',
                color,
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══ الكرت الرئيسي ══════════════════════════════════════════════ */
const VaultCard = memo(function VaultCard({
  vault, onEdit, onToggleSalesChannel, onTogglePaymentMethod, onArchive, onDelete, onClick,
}) {
  const { t, lang } = useTranslation();

  const { isCustom, emoji: customEmoji } = parseVaultType(vault.type);
  const typeInfo    = !isCustom ? (VAULT_TYPES.find((x) => x.value === vault.type) || VAULT_TYPES[0]) : null;
  const accentColor = !isCustom ? (TYPE_COLORS[vault.type] || 'var(--noorix-text-muted)') : 'var(--noorix-text-muted)';
  const isArchived  = vault.isArchived;
  const balance     = Number(vault.balance ?? 0);
  const totalIn     = Number(vault.totalIn ?? 0);
  const totalOut    = Number(vault.totalOut ?? 0);

  const typeLabels  = { cash: t('vaultTypeCash'), bank: t('vaultTypeBank'), app: t('vaultTypeApp') };
  const typeLabel   = typeLabels[vault.type] || vault.type;
  const displayName = vaultDisplayName(vault, lang);
  const subName     = lang === 'en' ? (vault.nameAr || typeLabel) : (vault.nameEn || typeLabel);

  return (
    /* لا overflow:hidden هنا — ضروري حتى تبرز قائمة الإجراءات (position:absolute) */
    <div
      onClick={() => onClick(vault)}
      className="noorix-surface-card relative flex cursor-pointer flex-col transition-[box-shadow] duration-150 hover:[box-shadow:var(--noorix-card-shadow-hover)]"
      style={{ opacity: isArchived ? 0.65 : 1 }}
    >
      <div
        className="h-1 rounded-t-[var(--noorix-card-radius)]"
        style={{ background: isArchived ? 'var(--noorix-border)' : accentColor }}
        aria-hidden
      />

      {/* هيدر الكرت */}
      <div className="flex items-center justify-between gap-2.5 pt-[14px] px-4 pb-3">
        <div className="flex items-center gap-10 min-w-0">
          <div className="flex items-center justify-center w-[38px] h-[38px] rounded-[10px] shrink-0" style={{
            background: isArchived ? 'var(--noorix-bg-muted)' : accentColor + '14',
            color: isArchived ? 'var(--noorix-text-muted)' : accentColor,
          }}>
            {isCustom
              ? <span className="text-[20px] leading-none">{customEmoji}</span>
              : (VAULT_TYPE_SVGS[vault.type] || VAULT_TYPE_SVGS.bank)}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[14px] truncate">
              {displayName}
            </div>
            <div className="text-[11px] text-noorix-muted mt-px">
              {subName}
            </div>
          </div>
        </div>

        <ActionMenu vault={vault} t={t} lang={lang} onEdit={onEdit} onToggleSalesChannel={onToggleSalesChannel} onTogglePaymentMethod={onTogglePaymentMethod} onArchive={onArchive} onDelete={onDelete} />
      </div>

      {/* الرصيد */}
      <div className="text-center pt-[2px] px-4 pb-4">
        <div className="text-[11px] text-noorix-muted mb-1 uppercase tracking-[0.04em]">
          {t('balance')}
        </div>
        <div className="font-extrabold text-[26px] tracking-[-0.5px]" style={{
          fontFamily: 'var(--noorix-font-numbers)',
          color: balance < 0 ? 'var(--noorix-accent-red)' : 'var(--noorix-text)',
        }}>
          {balance < 0 ? '−' : ''}{fmt(Math.abs(balance))}
          <span className="nx-sar mr-1">SR</span>
        </div>
      </div>

      <div className="mx-4 h-px" style={{ background: 'var(--noorix-border)' }} />

      {/* وارد / صادر */}
      <div className="grid grid-cols-2 gap-2 py-3 px-4">
        <div>
          <div className="flex items-center gap-4 text-noorix-muted text-[10px] mb-[3px]">
            <svg viewBox="0 0 12 12" fill="none" stroke="#16a34a" strokeWidth="2" width="10" height="10">
              <path d="M6 10V2M2 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('inbound')}
          </div>
          <div className="text-[13px] font-bold text-noorix-green" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            {fmt(totalIn)} <span className="nx-sar">SR</span>
          </div>
        </div>
        <div className="text-left pr-2" style={{ borderRight: '1px solid var(--noorix-border)' }}>
          <div className="flex items-center gap-4 text-noorix-muted text-[10px] mb-[3px] justify-end">
            {t('outbound')}
            <svg viewBox="0 0 12 12" fill="none" stroke="var(--noorix-accent-red)" strokeWidth="2" width="10" height="10">
              <path d="M6 2v8M2 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-[13px] font-bold text-noorix-text text-right" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            {fmt(totalOut)} <span className="nx-sar">SR</span>
          </div>
        </div>
      </div>

      {/* فوتر: شارات الحالة */}
      {(vault.isSalesChannel || vault.account?.code || isArchived || vault.showAsPaymentMethod === false) && (
        <div className="flex items-center flex flex-wrap gap-1.5 border-t border-noorix-border py-2 px-4">
          {vault.isSalesChannel && (
            <Badge color="green" size="sm">{t('salesChannel')}</Badge>
          )}
          {vault.showAsPaymentMethod === false && (
            <Badge color="amber" size="sm">{t('paymentMethodHiddenBadge')}</Badge>
          )}
          {vault.isSalesChannel && vault.paymentMethod && (() => {
            const pm = PAYMENT_METHODS.find((m) => m.value === vault.paymentMethod);
            const pmLabel = pm?.labelKey ? t(pm.labelKey) : (pm?.label ?? vault.paymentMethod);
            return <Badge color="gray" size="sm">{pmLabel}</Badge>;
          })()}
          {vault.account?.code && (
            <Badge color="gray" size="sm" style={{ marginRight: 'auto' }}>{vault.account.code}</Badge>
          )}
          {isArchived && (
            <Badge color="amber" size="sm">{t('archived')}</Badge>
          )}
        </div>
      )}
    </div>
  );
});

export default VaultCard;
