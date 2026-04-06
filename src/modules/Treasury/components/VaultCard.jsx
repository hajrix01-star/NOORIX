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

/* ── أيقونات SVG ───────────────────────────────────────────── */
const ICONS = {
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
      action: () => { onToggleSalesChannel(vault); setOpen(false); }, color: '#16a34a' },
    { label: paymentOn ? t('hidePaymentMethodOption') : t('showPaymentMethodOption'),
      action: () => { onTogglePaymentMethod(vault); setOpen(false); }, color: '#2563eb' },
    { label: isArchived ? t('restore') : t('archive'),
      action: () => { onArchive(vault); setOpen(false); }, color: '#d97706' },
    { label: t('delete'), action: () => { onDelete(vault); setOpen(false); }, color: '#dc2626' },
  ];

  return (
    <div
      ref={ref}
      style={{ position: 'relative', zIndex: 10 }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        className="vault-card-menu-btn"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: open ? 'var(--noorix-bg-muted)' : 'transparent',
          flexShrink: 0,
        }}
        title={t('actions')}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <circle cx="4" cy="10" r="1.8"/><circle cx="10" cy="10" r="1.8"/><circle cx="16" cy="10" r="1.8"/>
        </svg>
      </Button>

      {open && (
        <div
          className="nx-bg-surface nx-border-all nx-rounded-lg"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            ...(isRtl ? { left: 0 } : { right: 0 }),
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            minWidth: 160, width: 'max-content', maxWidth: 220,
            padding: '6px 0',
            direction: isRtl ? 'rtl' : 'ltr',
            zIndex: 100,
          }}
        >
          {items.map(({ label, action, color }) => (
            <Button
              key={label}
              variant="ghost"
              className="vault-card-action-item nx-w-full nx-text-base"
              onClick={action}
              style={{
                display: 'block',
                textAlign: isRtl ? 'right' : 'left',
                padding: '10px 16px', color, whiteSpace: 'nowrap',
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
  const accentColor = !isCustom ? (TYPE_COLORS[vault.type] || '#64748b') : '#64748b';
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
      className="nx-flex-col nx-bg-surface nx-cursor-pointer nx-border-all"
      style={{
        borderRadius: 14,
        opacity: isArchived ? 0.65 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        transition: 'box-shadow 150ms',
        position: 'relative',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.13)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
    >
      {/* شريط لوني علوي — نستخدم border-radius للزوايا بدل overflow:hidden */}
      <div style={{
        height: 3,
        background: isArchived ? 'var(--noorix-border)' : accentColor,
        borderRadius: '14px 14px 0 0',
      }} />

      {/* هيدر الكرت */}
      <div className="nx-flex-between nx-gap-10" style={{ padding: '14px 16px 12px' }}>
        <div className="nx-flex-center nx-gap-10" style={{ minWidth: 0 }}>
          <div className="nx-flex-center" style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: isArchived ? 'var(--noorix-bg-muted)' : accentColor + '14',
            color: isArchived ? 'var(--noorix-text-muted)' : accentColor,
            justifyContent: 'center',
          }}>
            {isCustom
              ? <span style={{ fontSize: 20, lineHeight: 1 }}>{customEmoji}</span>
              : (ICONS[vault.type] || ICONS.bank)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="nx-font-700 nx-text-md nx-truncate">
              {displayName}
            </div>
            <div className="nx-text-xs nx-text-muted" style={{ marginTop: 1 }}>
              {subName}
            </div>
          </div>
        </div>

        <ActionMenu vault={vault} t={t} lang={lang} onEdit={onEdit} onToggleSalesChannel={onToggleSalesChannel} onTogglePaymentMethod={onTogglePaymentMethod} onArchive={onArchive} onDelete={onDelete} />
      </div>

      {/* الرصيد */}
      <div className="nx-text-center" style={{ padding: '2px 16px 16px' }}>
        <div className="nx-text-xs nx-text-muted nx-mb-4 nx-uppercase" style={{ letterSpacing: '0.04em' }}>
          {t('balance')}
        </div>
        <div className="nx-font-800" style={{
          fontSize: 26, fontFamily: 'var(--noorix-font-numbers)',
          color: balance < 0 ? '#dc2626' : 'var(--noorix-text)',
          letterSpacing: '-0.5px',
        }}>
          {balance < 0 ? '−' : ''}{fmt(Math.abs(balance), 2)}
          <span className="nx-text-md nx-font-600 nx-text-muted" style={{ marginRight: 4 }}>﷼</span>
        </div>
      </div>

      <div style={{ margin: '0 16px', height: 1, background: 'var(--noorix-border)' }} />

      {/* وارد / صادر */}
      <div className="nx-grid-2 nx-gap-8 nx-py-12 nx-px-16">
        <div>
          <div className="nx-flex-center nx-gap-4 nx-text-muted" style={{ fontSize: 10, marginBottom: 3 }}>
            <svg viewBox="0 0 12 12" fill="none" stroke="#16a34a" strokeWidth="2" width="10" height="10">
              <path d="M6 10V2M2 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('inbound')}
          </div>
          <div className="nx-text-base nx-font-700 nx-text-income" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            {fmt(totalIn, 2)} <span className="nx-font-400 nx-text-muted nx-text-xs">﷼</span>
          </div>
        </div>
        <div style={{ textAlign: 'left', borderRight: '1px solid var(--noorix-border)', paddingRight: 8 }}>
          <div className="nx-flex-center nx-gap-4 nx-text-muted" style={{ fontSize: 10, marginBottom: 3, justifyContent: 'flex-end' }}>
            {t('outbound')}
            <svg viewBox="0 0 12 12" fill="none" stroke="#dc2626" strokeWidth="2" width="10" height="10">
              <path d="M6 2v8M2 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="nx-text-base nx-font-700 nx-text-primary" style={{ fontFamily: 'var(--noorix-font-numbers)', textAlign: 'right' }}>
            {fmt(totalOut, 2)} <span className="nx-font-400 nx-text-muted nx-text-xs">﷼</span>
          </div>
        </div>
      </div>

      {/* فوتر: شارات الحالة */}
      {(vault.isSalesChannel || vault.account?.code || isArchived || vault.showAsPaymentMethod === false) && (
        <div className="nx-flex-center nx-flex-wrap nx-gap-6 nx-border-t nx-py-8 nx-px-16">
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
