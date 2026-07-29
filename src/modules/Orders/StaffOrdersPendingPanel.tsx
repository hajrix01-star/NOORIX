import { fmt } from '../../utils/format';
import { formatSaudiDate } from '../../utils/saudiDate';
import { Badge, Button } from '../../ui';
import { formatVariantLabel } from './utils/staffOrderBasketUtils';
import { StaffItemPriceSuffix, StatusBadge } from './StaffOrdersSentPanels';
import type { StaffOrder } from '../../types/api';

type Translate = (key: string) => string;

type StaffOrdersPendingPanelProps = {
  orders: StaffOrder[];
  lang: string;
  t: Translate;
  onEdit: (order: StaffOrder) => void;
  onDelete: (order: StaffOrder) => void;
};

export function StaffOrdersPendingPanel({
  orders,
  lang,
  t,
  onEdit,
  onDelete,
}: StaffOrdersPendingPanelProps) {
  if (orders.length === 0) return null;

  return (
    <div className="noorix-surface-card overflow-hidden">
      <div className="px-4 py-3 border-b border-noorix-border flex items-center justify-between">
        <span className="text-[13px] font-bold">{t('staffOrderMyPending')}</span>
        <Badge color="amber" size="sm">{orders.length}</Badge>
      </div>
      <div className="divide-y divide-noorix-border">
        {orders.map((order) => (
          <div key={order.id} className="p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[14px]">{order.sectionName}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit(order)}>{t('edit')}</Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(order)}>{t('delete')}</Button>
              </div>
            </div>
            <div className="text-[11px] text-noorix-muted">{formatSaudiDate(order.createdAt)}</div>
            <div className="flex flex-col gap-1">
              {(order.items || []).map((item, index) => {
                const product = item.product;
                const name =
                  lang === 'en'
                    ? (product?.nameEn || product?.nameAr || '-')
                    : (product?.nameAr || product?.nameEn || '-');
                const variant = formatVariantLabel(item.size, item.packaging, item.unit);
                return (
                  <div key={index} className="flex justify-between gap-2 text-[13px]">
                    <div className="min-w-0">
                      <span>{name}</span>
                      {variant ? <div className="text-[11px] text-noorix-muted ltr">{variant}</div> : null}
                    </div>
                    <span className="font-semibold nx-font-numbers shrink-0 ltr text-end">
                      {fmt(item.quantity, 0)}
                      <StaffItemPriceSuffix it={item} product={product} />
                    </span>
                  </div>
                );
              })}
            </div>
            {order.notes && <div className="text-[11px] text-noorix-muted italic">{order.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
