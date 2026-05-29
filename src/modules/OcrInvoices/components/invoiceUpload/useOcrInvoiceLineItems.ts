import { useCallback, useMemo } from 'react';

/** بنود الفاتورة المعدّلة + تحذيرات + تعديل الكمية/السعر */
export function useOcrInvoiceLineItems(
  extracted: any,
  editItems: any,
  setEditItems: (v: any) => void,
) {
  const activeItems = editItems ?? extracted?.items ?? [];

  const warningCount = useMemo(() => {
    let n = 0;
    if (extracted?.invoiceTotalWarning) n++;
    activeItems.forEach((item: any) => {
      if (item.mathWarning) n++;
      if (item.priceWarning) n++;
    });
    return n;
  }, [extracted?.invoiceTotalWarning, activeItems]);

  const updateItem = useCallback(
    (index: any, field: any, value: any) => {
      const num = parseFloat(value);
      const updated = [...activeItems];
      updated[index] = { ...updated[index], [field]: isNaN(num) ? value : num };
      const item = updated[index];
      if ((field === 'quantity' || field === 'unitPrice') && item.quantity > 0 && item.unitPrice > 0) {
        updated[index] = {
          ...updated[index],
          totalPrice: Math.round(item.quantity * item.unitPrice * 100) / 100,
          mathWarning: undefined,
        };
      }
      if (field === 'totalPrice') {
        updated[index] = { ...updated[index], mathWarning: undefined };
      }
      setEditItems(updated);
    },
    [activeItems, setEditItems],
  );

  const applyMathSuggestion = useCallback(
    (index: any) => {
      const item = activeItems[index];
      if (!item?.mathWarning) return;
      const updated = [...activeItems];
      if (item.mathWarning.suggestedQuantity !== undefined) {
        updated[index] = { ...updated[index], quantity: item.mathWarning.suggestedQuantity, mathWarning: undefined };
      } else if (item.mathWarning.suggestedUnitPrice !== undefined) {
        updated[index] = { ...updated[index], unitPrice: item.mathWarning.suggestedUnitPrice, mathWarning: undefined };
      }
      setEditItems(updated);
    },
    [activeItems, setEditItems],
  );

  const updateItemMatch = useCallback(
    (index: number, match: any) => {
      const updated = [...activeItems];
      updated[index] = {
        ...updated[index],
        itemMatch: match || null,
      };
      setEditItems(updated);
    },
    [activeItems, setEditItems],
  );

  return { activeItems, warningCount, updateItem, applyMathSuggestion, updateItemMatch };
}
