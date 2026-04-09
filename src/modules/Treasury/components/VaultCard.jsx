import React, { memo, useState, useRef, useEffect } from 'react';
import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { useTranslation } from '../../../i18n/useTranslation';
import { VAULT_TYPES, PAYMENT_METHODS } from '../constants/treasuryConstants';
import { VAULT_TYPE_COLORS } from '../../../constants/kpiCardTheme';
import { Badge, Button, FmtNum, MetricCard } from '../../../ui';

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
  const accentColor = !isCustom ? (VAULT_TYPE_COLORS[vault.type] || 'var(--noorix-text-muted)') : 'var(--noorix-text-muted)';
  const isArchived  = vault.isArchived;
  const balance     = Number(vault.balance ?? 0);
  const totalIn     = Number(vault.totalIn ?? 0);
  const totalOut    = Number(vault.totalOut ?? 0);

  /* بيانات السباركلاين: رصيد بداية الفترة ← منتصفها ← الرصيد الحالي */
  const prevBalance = balance - totalIn + totalOut;
  const sparkData = (totalIn > 0 || totalOut > 0)
    ? [prevBalance, prevBalance + (totalIn - totalOut) * 0.4, prevBalance + (totalIn - totalOut) * 0.75, balance]
    : [];

  const typeLabels  = { cash: t('vaultTypeCash'), bank: t('vaultTypeBank'), app: t('vaultTypeApp') };
  const typeLabel   = typeLabels[vault.type] || vault.type;
  const displayName = vaultDisplayName(vault, lang);
  const subName     = lang === 'en' ? (vault.nameAr || typeLabel) : (vault.nameEn || typeLabel);

  const hasBadges = vault.isSalesChannel || vault.account?.code || isArchived || vault.showAsPaymentMethod === false;

  return (
    /* MetricCard يدير: الحاوية + الشريط العلوي + الشفافية + hover shadow */
    <MetricCard
      color={accentColor}
      isArchived={isArchived}
      onClick={() => onClick(vault)}
    >
      {/* الهيدر: أيقونة + اسم + قائمة إجراءات */}
      <MetricCard.Header
        label={displayName}
        subLabel={subName}
        icon={
          <div
            className="flex items-center justify-center w-[38px] h-[38px] rounded-[10px] shrink-0"
            style={{
              background: isArchived ? 'var(--noorix-bg-muted)' : accentColor + '14',
              color: isArchived ? 'var(--noorix-text-muted)' : accentColor,
            }}
          >
            {isCustom
              ? <span className="text-[20px] leading-none">{customEmoji}</span>
              : (VAULT_TYPE_SVGS[vault.type] || VAULT_TYPE_SVGS.bank)}
          </div>
        }
        actions={
          <ActionMenu
            vault={vault} t={t} lang={lang}
            onEdit={onEdit}
            onToggleSalesChannel={onToggleSalesChannel}
            onTogglePaymentMethod={onTogglePaymentMethod}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        }
      />

      {/* الرصيد */}
      <MetricCard.Value
        label={t('balance')}
        value={balance}
        currency="SR"
        align="center"
        size="lg"
        prefix={balance < 0 ? '−' : ''}
        color={balance < 0 ? 'var(--noorix-accent-red)' : undefined}
      />

      {/* سباركلاين اتجاه الرصيد خلال الفترة */}
      <MetricCard.Spark data={sparkData} color={accentColor} height={32} />

      <MetricCard.Divider />

      {/* وارد / صادر */}
      <MetricCard.Section className="grid grid-cols-2 gap-2 py-3">
        <div>
          <div className="flex items-center gap-4 text-noorix-muted text-[10px] mb-[3px]">
            <svg viewBox="0 0 12 12" fill="none" stroke="#16a34a" strokeWidth="2" width="10" height="10">
              <path d="M6 10V2M2 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('inbound')}
          </div>
          <div dir="ltr" className="text-[13px] font-bold text-noorix-green" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            <FmtNum n={totalIn} /> <span className="nx-sar">SR</span>
          </div>
        </div>
        <div className="text-left pr-2" style={{ borderRight: '1px solid var(--noorix-border)' }}>
          <div className="flex items-center gap-4 text-noorix-muted text-[10px] mb-[3px] justify-end">
            {t('outbound')}
            <svg viewBox="0 0 12 12" fill="none" stroke="var(--noorix-accent-red)" strokeWidth="2" width="10" height="10">
              <path d="M6 2v8M2 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div dir="ltr" className="text-[13px] font-bold text-noorix-text text-right" style={{ fontFamily: 'var(--noorix-font-numbers)' }}>
            <FmtNum n={totalOut} /> <span className="nx-sar">SR</span>
          </div>
        </div>
      </MetricCard.Section>

      {/* شارات الحالة (عند وجودها) */}
      {hasBadges && (
        <MetricCard.Footer className="flex-wrap gap-1.5 border-t border-noorix-border py-2">
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
        </MetricCard.Footer>
      )}
    </MetricCard>
  );
});

export default VaultCard;
