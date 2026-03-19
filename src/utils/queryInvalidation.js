/**
 * queryInvalidation — إبطال الكاش المركزي للعمليات المالية.
 * أي mutation يؤثر على الفواتير/الحركات/الخزائن يجب أن يستدعي invalidateOnFinancialMutation
 * لضمان تحديث التقارير والقوائم مباشرة دون الحاجة لتحديث يدوي.
 *
 * @see docs/PERFORMANCE_AND_DATA.md
 */

/**
 * إبطال جميع الاستعلامات المتأثرة بتغيير مالي (فواتير، مبيعات، مشتريات، مصروفات، حركات).
 * يُستدعى بعد أي create/update/delete/cancel للفواتير أو الحركات.
 *
 * @param {QueryClient} queryClient
 */
export function invalidateOnFinancialMutation(queryClient) {
  if (!queryClient) return;
  queryClient.invalidateQueries({ queryKey: ['invoices'] });
  queryClient.invalidateQueries({ queryKey: ['vaults'] });
  queryClient.invalidateQueries({ queryKey: ['sales-summaries'] });
  queryClient.invalidateQueries({ queryKey: ['sales-summaries-paged'] });
  queryClient.invalidateQueries({ queryKey: ['purchase-batch-summaries'] });
  queryClient.invalidateQueries({ queryKey: ['ledger'] });
  queryClient.invalidateQueries({ queryKey: ['reports'] });
}
