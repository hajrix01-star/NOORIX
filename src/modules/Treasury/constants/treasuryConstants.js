// Labels resolved via useTranslation in components (vaultTypeCash, vaultTypeBank, vaultTypeApp, paymentCash, etc.)
export const VAULT_TYPES = [
  { value: 'cash', labelKey: 'vaultTypeCash', icon: '💵' },
  { value: 'bank', labelKey: 'vaultTypeBank', icon: '🏦' },
  { value: 'app',  labelKey: 'vaultTypeApp',  icon: '📱' },
];

export const PAYMENT_METHODS = [
  { value: 'cash',      labelKey: 'paymentCash'     },
  { value: 'card',      labelKey: 'paymentCard'     },
  { value: 'transfer',  labelKey: 'paymentTransfer' },
  { value: 'mada',      labelKey: 'paymentMada'     },
  { value: 'stc_pay',   labelKey: 'stcPay'          },
  { value: 'apple_pay', labelKey: 'applePay'        },
];

export const TYPE_COLORS = { cash: '#16a34a', bank: '#2563eb', app: '#7c3aed' };
export const TYPE_BG     = {
  cash: 'rgba(22,163,74,0.1)',
  bank: 'rgba(37,99,235,0.1)',
  app:  'rgba(124,58,237,0.1)',
};
