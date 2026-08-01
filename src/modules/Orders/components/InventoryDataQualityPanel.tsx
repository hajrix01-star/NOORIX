import type { InventoryDataQualityReport } from '../../../types/api';
import { Badge, Button } from '../../../ui';

type InventoryDataQualityPanelProps = {
  quality?: InventoryDataQualityReport;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
};

function QualityMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-t border-current/10 px-3 py-3 text-center first:border-t-0 sm:border-t-0 sm:border-s">
      <div className="text-[11px] font-semibold opacity-75">{label}</div>
      <div className="mt-1 text-[18px] font-extrabold">{value}</div>
    </div>
  );
}

function checkedAtLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InventoryDataQualityPanel({
  quality,
  isLoading = false,
  error,
  onRetry,
}: InventoryDataQualityPanelProps) {
  if (isLoading) {
    return (
      <section
        aria-busy="true"
        aria-label="جودة بيانات المخزون"
        className="border border-noorix-border bg-white px-4 py-4 text-right shadow-sm"
      >
        <div className="text-[13px] font-bold text-noorix-muted">جاري فحص جودة بيانات المخزون...</div>
      </section>
    );
  }

  if (error || !quality) {
    return (
      <section role="alert" className="border border-amber-300 bg-amber-50 px-4 py-4 text-right text-amber-950 shadow-sm">
        <div className="font-extrabold">تعذر التحقق من جودة بيانات المخزون.</div>
        <div className="mt-1 text-[12px] leading-5">الرصيد ما زال متاحًا، لكن درجة الاعتماد غير معروضة حتى ينجح الفحص.</div>
        {onRetry ? <Button className="mt-3" size="sm" onClick={onRetry}>إعادة المحاولة</Button> : null}
      </section>
    );
  }

  const needsReview = quality.status === 'needs_review';
  const missingSnapshots = quality.snapshots.purchases.missingItems
    + quality.snapshots.consumption.missingItems;
  const verifiedSnapshots = quality.snapshots.purchases.verifiedItems
    + quality.snapshots.consumption.verifiedItems;
  const totalSnapshots = quality.snapshots.purchases.totalItems
    + quality.snapshots.consumption.totalItems;
  const checkedAt = checkedAtLabel(quality.checkedAt);

  return (
    <section
      aria-labelledby="inventory-data-quality-title"
      className={`border px-4 py-4 text-right shadow-sm ${
        needsReview
          ? 'border-amber-300 bg-amber-50 text-amber-950'
          : 'border-emerald-300 bg-emerald-50 text-emerald-950'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="inventory-data-quality-title" className="text-[15px] font-extrabold">جودة بيانات المخزون</h3>
            <Badge color={needsReview ? 'amber' : 'green'} size="sm" dot>
              {needsReview ? 'تحتاج مراجعة' : 'موثقة'}
            </Badge>
          </div>
          <p className="mt-1 text-[12px] leading-5 opacity-80">
            {needsReview
              ? 'يتضمن الرصيد بيانات قديمة محفوظة أو صفوفًا حُسبت بتقدير بديل؛ راجع العدادات قبل اعتماد الرصيد.'
              : 'كل صفوف الشراء والاستهلاك النشطة تعتمد snapshots صالحة، ولا توجد بيانات من مسار Shisha السابق.'}
          </p>
        </div>
        {checkedAt ? <time dateTime={quality.checkedAt} className="shrink-0 text-[11px] opacity-70">آخر فحص: {checkedAt}</time> : null}
      </div>

      <div className="mt-3 grid grid-cols-1 overflow-hidden border-y border-current/10 sm:grid-cols-3 xl:grid-cols-6">
        <QualityMetric label="صفوف Shisha محفوظة" value={quality.legacy.shishaTotalRows} />
        <QualityMetric label="مشتريات Legacy" value={quality.legacy.purchaseItemsWithoutSnapshot} />
        <QualityMetric label="مبيعات مقدرة" value={quality.estimated.saleItemsFromCurrentRecipe} />
        <QualityMetric label="Snapshots مفقودة" value={missingSnapshots} />
        <QualityMetric label="Snapshots غير صالحة" value={quality.snapshots.consumption.invalidItems} />
        <QualityMetric label="Snapshots موثقة" value={`${verifiedSnapshots}/${totalSnapshots}`} />
      </div>

      <div className="mt-3 text-[11px] leading-5 opacity-75">
        صفوف المسار السابق: إعدادات {quality.legacy.shishaSettingsRows}، حركات {quality.legacy.shishaMovementRows}، جرد {quality.legacy.shishaStocktakeRows}.
        هذه الصفوف محفوظة للشفافية ولا تدخل تلقائيًا في رصيد المخزون العام.
      </div>
    </section>
  );
}

export default InventoryDataQualityPanel;
