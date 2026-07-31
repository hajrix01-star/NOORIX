import Decimal from 'decimal.js';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  useCreateInventoryStocktakeMutation,
  useInventoryStocktakes,
} from '../../../hooks/useOrders';
import type {
  InventoryStocktake,
  InventoryStocktakeLine,
  OrderRecipeInventoryStockRow,
} from '../../../types/api';
import {
  AdaptiveSheet,
  Badge,
  Button,
  DialogActions,
  Input,
  Spinner,
} from '../../../ui';
import { formatSaudiDate, getSaudiToday } from '../../../utils/saudiDate';

type StocktakeSheetMode = 'create' | 'history';

type InventoryStocktakeSheetProps = {
  companyId: string;
  mode: StocktakeSheetMode;
  open: boolean;
  onClose: () => void;
  currentRows: OrderRecipeInventoryStockRow[];
  allRows: OrderRecipeInventoryStockRow[];
  currentSectionLabel: string;
};

type CountScope = 'current' | 'all';

type CountRow = OrderRecipeInventoryStockRow & {
  physicalQuantity: string;
  varianceQuantity: string;
  inputError: string | null;
};

const PHYSICAL_QUANTITY_PATTERN = /^\d{1,12}(?:\.\d{1,6})?$/;

function decimalOrNull(value: unknown): Decimal | null {
  try {
    const parsed = new Decimal(String(value ?? '').trim());
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function canonicalDecimal(value: unknown, fallback = '0'): string {
  const parsed = decimalOrNull(value);
  if (!parsed) return fallback;
  const decimalPlaces = Math.min(parsed.decimalPlaces(), 6);
  return parsed.toFixed(decimalPlaces);
}

function formatQuantity(value: unknown, maximumFractionDigits = 3): string {
  const parsed = decimalOrNull(value);
  if (!parsed) return '-';
  const fractionDigits = Math.min(parsed.decimalPlaces(), maximumFractionDigits);
  const fixed = parsed.toDecimalPlaces(fractionDigits, Decimal.ROUND_HALF_UP).toFixed(fractionDigits);
  const [signedInteger, fraction] = fixed.split('.');
  const sign = signedInteger.startsWith('-') ? '-' : '';
  const integer = sign ? signedInteger.slice(1) : signedInteger;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`;
}

function defaultPhysicalQuantity(value: unknown): string {
  const parsed = decimalOrNull(value);
  if (!parsed || parsed.isNegative()) return '0';
  return canonicalDecimal(parsed);
}

function buildPhysicalQuantities(rows: readonly OrderRecipeInventoryStockRow[]) {
  return Object.fromEntries(rows.map((row) => [row.productId, defaultPhysicalQuantity(row.balanceBaseQuantity)]));
}

function physicalQuantityError(value: string): string | null {
  const clean = value.trim();
  if (!clean) return 'أدخل الكمية الفعلية.';
  if (!PHYSICAL_QUANTITY_PATTERN.test(clean)) {
    return 'استخدم رقماً موجباً حتى 12 خانة و6 منازل عشرية.';
  }
  const parsed = decimalOrNull(clean);
  if (!parsed || parsed.isNegative()) return 'الكمية الفعلية يجب أن تكون صفراً أو أكثر.';
  return null;
}

function varianceQuantity(physical: string, expected: unknown): string {
  const physicalDecimal = decimalOrNull(physical);
  const expectedDecimal = decimalOrNull(expected);
  if (!physicalDecimal || !expectedDecimal) return '0';
  return canonicalDecimal(physicalDecimal.minus(expectedDecimal));
}

function decimalTone(value: unknown): string {
  const parsed = decimalOrNull(value);
  if (parsed?.isPositive()) return 'text-emerald-700';
  if (parsed?.isNegative()) return 'text-red-700';
  return 'text-noorix-muted';
}

function stocktakeUserName(stocktake: InventoryStocktake): string {
  const user = stocktake.createdBy;
  return user?.nameAr || user?.nameEn || user?.email || '-';
}

function CountItemCard({
  row,
  disabled,
  onChange,
}: {
  row: CountRow;
  disabled: boolean;
  onChange: (productId: string, value: string) => void;
}) {
  return (
    <article className="rounded-md border border-noorix-border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-right">
          <div className="truncate text-[14px] font-extrabold text-noorix-text">{row.productNameAr}</div>
          {row.productNameEn ? <div className="truncate text-[11px] text-noorix-muted">{row.productNameEn}</div> : null}
        </div>
        <Badge color="gray" size="sm">{row.unit}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded bg-noorix-bg-muted px-3 py-2 text-center">
          <div className="text-[11px] font-semibold text-noorix-muted">الدفتري</div>
          <div className="mt-1 font-extrabold text-noorix-text">{formatQuantity(row.balanceBaseQuantity, 6)}</div>
        </div>
        <label className="block text-center">
          <span className="text-[11px] font-semibold text-noorix-muted">الفعلي</span>
          <Input
            type="text"
            inputMode="decimal"
            value={row.physicalQuantity}
            disabled={disabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(row.productId, event.target.value)}
            containerClassName="mt-1"
            className={`h-10 text-center text-[16px] font-extrabold ${row.inputError ? 'border-red-400' : ''}`}
            aria-label={`الكمية الفعلية لـ ${row.productNameAr}`}
            aria-invalid={Boolean(row.inputError)}
          />
        </label>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
        <span className="font-semibold text-noorix-muted">الفرق</span>
        <span className={`font-extrabold ${decimalTone(row.varianceQuantity)}`}>
          {formatQuantity(row.varianceQuantity, 6)} {row.unit}
        </span>
      </div>
      {row.inputError ? <div className="mt-2 text-right text-[11px] font-semibold text-red-700">{row.inputError}</div> : null}
    </article>
  );
}

function HistoryLineList({ lines }: { lines: InventoryStocktakeLine[] }) {
  return (
    <div className="divide-y divide-noorix-border rounded-md border border-noorix-border bg-white">
      {lines.map((line) => (
        <div key={line.id} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 font-bold text-noorix-text">
              {line.product.nameAr || line.product.nameEn || '-'}
            </div>
            <Badge color="gray" size="sm">{line.unit}</Badge>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
            <div><div className="text-noorix-muted">الدفتري</div><strong>{formatQuantity(line.expectedQuantity, 6)}</strong></div>
            <div><div className="text-noorix-muted">الفعلي</div><strong>{formatQuantity(line.physicalQuantity, 6)}</strong></div>
            <div><div className="text-noorix-muted">الفرق</div><strong className={decimalTone(line.varianceQuantity)}>{formatQuantity(line.varianceQuantity, 6)}</strong></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InventoryStocktakeHistory({ companyId }: { companyId: string }) {
  const historyQuery = useInventoryStocktakes(companyId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (historyQuery.isLoading) return <Spinner.Page label="جاري تحميل سجل الجرد..." />;

  if (historyQuery.error) {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-center">
        <div className="font-bold text-red-700">تعذر تحميل سجل الجرد.</div>
        <Button className="mt-3" size="sm" onClick={() => historyQuery.refetch()}>إعادة المحاولة</Button>
      </div>
    );
  }

  const stocktakes = historyQuery.data ?? [];
  if (stocktakes.length === 0) {
    return <div className="rounded-md border border-dashed border-noorix-border p-8 text-center text-noorix-muted">لا توجد عمليات جرد معتمدة بعد.</div>;
  }

  return (
    <div className="space-y-2" dir="rtl">
      {stocktakes.map((stocktake) => {
        const expanded = expandedId === stocktake.id;
        const differences = stocktake.lines.filter((line) => !decimalOrNull(line.varianceQuantity)?.isZero()).length;
        return (
          <article key={stocktake.id} className="overflow-hidden rounded-md border border-noorix-border bg-white shadow-sm">
            <Button
              type="button"
              variant="raw"
              size="auto"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-noorix-bg-muted"
              onClick={() => setExpandedId(expanded ? null : stocktake.id)}
              aria-expanded={expanded}
            >
              <div className="min-w-0">
                <div className="font-extrabold text-noorix-text">{formatSaudiDate(stocktake.stocktakeDate)}</div>
                <div className="mt-1 truncate text-[12px] text-noorix-muted">
                  {stocktake.lines.length} مادة · {differences} بفروقات · {stocktakeUserName(stocktake)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge color={stocktake.status === 'approved' ? 'green' : 'gray'} size="sm">
                  {stocktake.status === 'approved' ? 'معتمد' : stocktake.status}
                </Badge>
                <span className="text-[16px] font-bold text-noorix-muted" aria-hidden="true">{expanded ? '−' : '+'}</span>
              </div>
            </Button>
            {expanded ? (
              <div className="space-y-3 border-t border-noorix-border bg-noorix-bg-muted/40 p-3">
                {stocktake.notes ? <div className="rounded bg-white px-3 py-2 text-[12px] text-noorix-text">{stocktake.notes}</div> : null}
                <HistoryLineList lines={stocktake.lines} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export default function InventoryStocktakeSheet({
  companyId,
  mode,
  open,
  onClose,
  currentRows,
  allRows,
  currentSectionLabel,
}: InventoryStocktakeSheetProps) {
  const stocktakeDate = useMemo(() => getSaudiToday(), []);
  const [scope, setScope] = useState<CountScope>('current');
  const [notes, setNotes] = useState('');
  const [physicalByProductId, setPhysicalByProductId] = useState<Record<string, string>>({});
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const createSessionOpenRef = useRef(false);
  const createStocktake = useCreateInventoryStocktakeMutation(companyId);

  useEffect(() => {
    const createSessionOpen = open && mode === 'create';
    if (createSessionOpen && !createSessionOpenRef.current) {
      setScope('current');
      setNotes('');
      setSubmitSucceeded(false);
      createStocktake.reset();
      setPhysicalByProductId(buildPhysicalQuantities(allRows));
    }
    createSessionOpenRef.current = createSessionOpen;
  }, [allRows, createStocktake, mode, open]);

  const scopedRows = scope === 'all' ? allRows : currentRows;
  const countRows = useMemo<CountRow[]>(() => scopedRows.map((row) => {
    const physicalQuantity = physicalByProductId[row.productId] ?? defaultPhysicalQuantity(row.balanceBaseQuantity);
    return {
      ...row,
      physicalQuantity,
      varianceQuantity: varianceQuantity(physicalQuantity, row.balanceBaseQuantity),
      inputError: physicalQuantityError(physicalQuantity),
    };
  }), [physicalByProductId, scopedRows]);

  const canSubmit = countRows.length > 0
    && stocktakeDate === getSaudiToday()
    && countRows.every((row) => row.inputError === null)
    && !createStocktake.isPending
    && !submitSucceeded;

  const guardedClose = () => {
    if (!createStocktake.isPending) onClose();
  };

  const updatePhysicalQuantity = (productId: string, value: string) => {
    if (createStocktake.isPending || submitSucceeded) return;
    setPhysicalByProductId((current) => ({ ...current, [productId]: value }));
  };

  const submitStocktake = async () => {
    if (!canSubmit) return;
    try {
      await createStocktake.mutateAsync({
        stocktakeDate,
        notes: notes.trim() || undefined,
        lines: countRows.map((row) => ({
          productId: row.productId,
          physicalQuantity: canonicalDecimal(row.physicalQuantity),
        })),
      });
      setSubmitSucceeded(true);
    } catch {
      // The shared mutation layer exposes the backend message in a toast.
    }
  };

  const createContent = (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-md border border-noorix-border bg-noorix-bg-muted p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[12px] font-semibold text-noorix-muted">تاريخ الجرد</div>
            <div className="mt-1 text-[15px] font-extrabold text-noorix-text">{formatSaudiDate(stocktakeDate)}</div>
            <div className="mt-1 text-[11px] text-noorix-muted">الجرد التشغيلي يعتمد بتاريخ اليوم بتوقيت السعودية.</div>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[12px] font-semibold text-noorix-muted">نطاق الجرد</span>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-noorix-border bg-white p-1">
              <Button
                type="button"
                variant="raw"
                size="auto"
                disabled={createStocktake.isPending || submitSucceeded}
                className={`min-w-0 rounded px-3 py-2 text-[12px] font-bold ${scope === 'current' ? 'bg-emerald-700 text-white' : 'text-noorix-text'}`}
                onClick={() => setScope('current')}
              >
                <span className="block truncate">{currentSectionLabel}</span>
              </Button>
              <Button
                type="button"
                variant="raw"
                size="auto"
                disabled={createStocktake.isPending || submitSucceeded}
                className={`rounded px-3 py-2 text-[12px] font-bold ${scope === 'all' ? 'bg-emerald-700 text-white' : 'text-noorix-text'}`}
                onClick={() => setScope('all')}
              >
                جرد كامل
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-3 text-[12px] text-noorix-muted">
          {countRows.length} مادة. تغيير النطاق لا يمسح الكميات التي أدخلتها.
        </div>
      </div>

      {countRows.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {countRows.map((row) => (
            <CountItemCard
              key={row.productId}
              row={row}
              disabled={createStocktake.isPending || submitSucceeded}
              onChange={updatePhysicalQuantity}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-noorix-border p-8 text-center text-noorix-muted">لا توجد مواد ضمن نطاق الجرد المحدد.</div>
      )}

      <Input
        label="ملاحظات الجرد"
        multiline
        rows={2}
        value={notes}
        disabled={createStocktake.isPending || submitSucceeded}
        maxLength={1000}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNotes(event.target.value)}
        placeholder="سبب الجرد أو ملاحظة الاعتماد..."
      />

      {createStocktake.error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] font-semibold text-red-700">
          تعذر اعتماد الجرد. راجع الكميات ثم أعد المحاولة. {createStocktake.error.message}
        </div>
      ) : null}

      {submitSucceeded ? (
        <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[13px] font-bold text-emerald-800">
          تم اعتماد الجرد وتسجيل حركات الفروقات بنجاح.
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] leading-6 text-amber-900">
          سيعيد النظام حساب الرصيد الدفتري لحظة الاعتماد، ثم يسجل مستنداً غير قابل للتعديل. أي تصحيح لاحق يتم بجرد جديد.
        </div>
      )}
    </div>
  );

  return (
    <AdaptiveSheet
      open={open}
      onClose={guardedClose}
      closeOnBackdrop={!createStocktake.isPending}
      hideClose={createStocktake.isPending}
      title={mode === 'create' ? 'جرد المخزون' : 'سجل الجرد والتسويات'}
      size="2xl"
      footer={(
        <DialogActions
          actions={[
            {
              key: 'close',
              label: submitSucceeded ? 'تم' : 'إغلاق',
              role: 'close',
              onClick: guardedClose,
              disabled: createStocktake.isPending,
            },
            {
              key: 'approve',
              label: 'اعتماد الجرد',
              role: 'save',
              onClick: submitStocktake,
              loading: createStocktake.isPending,
              disabled: !canSubmit,
              hidden: mode !== 'create' || submitSucceeded,
            },
          ]}
        />
      )}
    >
      {mode === 'create' ? createContent : <InventoryStocktakeHistory companyId={companyId} />}
    </AdaptiveSheet>
  );
}
