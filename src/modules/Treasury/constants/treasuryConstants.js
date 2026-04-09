// Labels resolved via useTranslation in components (vaultTypeCash, vaultTypeBank, vaultTypeApp, paymentCash, etc.)
import { VAULT_TYPE_COLORS, VAULT_TYPE_BG } from '../../../constants/kpiCardTheme';

export const VAULT_TYPES = [
  { value: 'cash', labelKey: 'vaultTypeCash' },
  { value: 'bank', labelKey: 'vaultTypeBank' },
  { value: 'app',  labelKey: 'vaultTypeApp' },
];

export const PAYMENT_METHODS = [
  { value: 'cash',      labelKey: 'paymentCash'     },
  { value: 'card',      labelKey: 'paymentCard'     },
  { value: 'transfer',  labelKey: 'paymentTransfer' },
  { value: 'mada',      labelKey: 'paymentMada'     },
  { value: 'stc_pay',   labelKey: 'stcPay'          },
  { value: 'apple_pay', labelKey: 'applePay'        },
];

/** re-export من المصدر الموحّد kpiCardTheme.js */
export const TYPE_COLORS = VAULT_TYPE_COLORS;
export const TYPE_BG     = VAULT_TYPE_BG;
