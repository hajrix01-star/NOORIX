/**
 * financial-operation.dto — واجهات عمليات المحرك المالي
 */
export interface SalesChannelDto {
  vaultId: string;
  amount: string;
}

/** توزيع السداد على أكثر من خزنة — مجموع المبالغ يجب أن يساوي totalAmount */
export interface OutflowVaultSplitDto {
  vaultId: string;
  amount: string;
}

export interface OutflowDto {
  companyId: string;
  supplierId?: string;
  employeeId?: string;
  expenseLineId?: string;
  categoryId?: string;
  /** سيريال داخلي — يُولَّد تلقائياً من النظام، لا يُقبل من العميل */
  invoiceNumber?: string;
  /** رقم فاتورة المورد — مطلوب عند وجود مورد */
  supplierInvoiceNumber?: string;
  kind: string;
  totalAmount: string;
  netAmount: string;
  taxAmount: string;
  transactionDate: string;
  invoiceDate?: string;
  vaultId?: string;
  /** عند الإرسال يُتجاهل vaultId إن وُجد (يُستنتج من الأجزاء) */
  vaultSplits?: OutflowVaultSplitDto[];
  batchId?: string;
  debitAccountId?: string;
  notes?: string;
  /** مفتاح عدم التكرار — إن وُجد يُرجع النتيجة المخزنة بدل التنفيذ مرة ثانية */
  idempotencyKey?: string;
  /** للسلف بالأقساط: عدد الدفعات */
  installmentCount?: number;
  /** للسلف بالأقساط: مبلغ القسط الواحد */
  installmentAmount?: string;
}

export interface InflowDto {
  companyId: string;
  transactionDate: string;
  customerCount?: number;
  cashOnHand?: string;
  channels: SalesChannelDto[];
  notes?: string;
  /** مفتاح عدم التكرار — إن وُجد يُرجع النتيجة المخزنة بدل التنفيذ مرة ثانية */
  idempotencyKey?: string;
}

export interface TransferDto {
  companyId: string;
  fromVaultId: string;
  toVaultId: string;
  amount: string;
  transactionDate: string;
  notes?: string;
  /** مفتاح عدم التكرار — إن وُجد يُرجع النتيجة المخزنة بدل التنفيذ مرة ثانية */
  idempotencyKey?: string;
}

export interface OutflowBatchIdempotencyDto {
  /** مفتاح عدم التكرار على مستوى الدفعة الكاملة */
  idempotencyKey?: string;
}

export interface CancelOperationDto {
  companyId: string;
  referenceType: string;
  referenceId: string;
  reason?: string;
}
