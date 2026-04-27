import { GROUP_LABELS, type AggregatedGroup, type GroupKey } from './reports-general-profit-loss-model.util';
import { plZeroMonths } from './reports-pl-math.util';

export function createPlGroupStates(): Record<GroupKey, AggregatedGroup> {
  return {
    sales: {
      key: 'sales',
      labelAr: GROUP_LABELS.sales.ar,
      labelEn: GROUP_LABELS.sales.en,
      months: plZeroMonths(),
      items: new Map(),
    },
    purchases: {
      key: 'purchases',
      labelAr: GROUP_LABELS.purchases.ar,
      labelEn: GROUP_LABELS.purchases.en,
      months: plZeroMonths(),
      items: new Map(),
    },
    expenses: {
      key: 'expenses',
      labelAr: GROUP_LABELS.expenses.ar,
      labelEn: GROUP_LABELS.expenses.en,
      months: plZeroMonths(),
      items: new Map(),
    },
  };
}
