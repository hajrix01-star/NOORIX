/**
 * تنسيق نص واتساب — رموز BMP + سطور متوازية (تسمية · قيمة).
 */

export const WA = {
  rule: '━━━━━━━━━━━━━━━━━━━━',
  ruleThin: '────────────────────',
  dot: '·',
  icon: {
    meta: '▸',
    sales: '☀',
    outflow: '☾',
    closing: '◆',
    total: 'Σ',
    channels: '⊞',
    channel: '│',
    customers: '#',
    purchases: '⊖',
    expenses: '⊘',
    outTotal: '⊕',
    net: '±',
    cashIn: '↓',
    cashOut: '↑',
    cashNet: '⊙',
    note: '○',
  },
} as const;

function trimLabel(label: string): string {
  return label.replace(/[:：]\s*$/u, '').trim();
}

/** رأس التقرير */
export function waHeader(title: string, companyName?: string): string {
  const head = (companyName || '').trim() ? `${title} — ${companyName.trim()}` : title;
  return `${WA.rule}\n${head}\n${WA.rule}`;
}

/** سطر ميتا (تاريخ) */
export function waMeta(label: string, value: string): string {
  return `${WA.icon.meta}  ${trimLabel(label)} ${WA.dot}  ${value}`;
}

/** عنوان قسم */
export function waSection(icon: string, title: string): string {
  return `${WA.ruleThin}\n${icon}  ${title}\n${WA.ruleThin}`;
}

/** عنوان فرعي بدون قيمة */
export function waSubhead(icon: string, label: string): string {
  return `  ${icon}  ${trimLabel(label)}`;
}

/** سطر قيمة موازٍ: رمز · تسمية · قيمة */
export function waRow(icon: string, label: string, value: string): string {
  return `  ${icon}  ${trimLabel(label)} ${WA.dot}  ${value}`;
}

/** سطر قناة */
export function waChannel(label: string, amountText: string): string {
  return `  ${WA.icon.channel}  ${label} ${WA.dot}  ${amountText} SR`;
}

/** سطر فارغ / لا بيانات */
export function waEmpty(icon: string, message: string): string {
  return `  ${icon}  ${message}`;
}
