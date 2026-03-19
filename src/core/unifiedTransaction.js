import { invalidateRelated } from '../utils/cacheHelper';
import Decimal from 'decimal.js';

/**
 * Validate the transactional payload based on common financial rules.
 * Validation depends on kind: sales (inflow) may not require supplier; expenses/invoices require supplier and payment method.
 *
 * @param {string} kind - logical operation type, e.g. 'sales:summary', 'invoices:purchase', 'expense', 'transfer'
 * @param {object} payload - raw transaction payload coming from UI / caller
 */
export function validateTransactionPayload(kind, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('TRANSACTION_PAYLOAD_REQUIRED');
  }

  const amountField =
    payload.totalAmount ??
    payload.amount ??
    payload.grossAmount ??
    payload.netAmount ??
    0;
  const amount = new Decimal(amountField || 0);
  if (amount.lte(0)) {
    throw new Error('TRANSACTION_AMOUNT_MUST_BE_POSITIVE');
  }

  if (!payload.transactionDate && !payload.date) {
    throw new Error('TRANSACTION_DATE_REQUIRED');
  }

  const isInflow = /^sales:/i.test(kind);
  const isTransfer = /transfer/i.test(kind);

  if (isTransfer) {
    if (!payload.fromVaultId && !payload.fromVault) throw new Error('VAULT_REQUIRED');
    if (!payload.toVaultId && !payload.toVault) throw new Error('VAULT_REQUIRED');
    return;
  }

  if (!isInflow) {
    if (!payload.supplierId && !payload.supplier) {
      throw new Error('SUPPLIER_REQUIRED');
    }
    if (!payload.paymentMethod && !payload.paymentMethodId) {
      throw new Error('PAYMENT_METHOD_REQUIRED');
    }
  }

  if (isInflow && (!payload.vaultId && !payload.vault)) {
    throw new Error('VAULT_REQUIRED');
  }
}

/**
 * Build dual dates:
 * - transactionDate: user-selected date (immutable from caller perspective)
 * - entryDate: system "now" timestamp for audit trails (immutable, UTC ISO)
 *
 * NOTE: Server / runtime should be configured for Asia/Riyadh (UTC+3) as per rules.
 *
 * @param {string|Date} userTransactionDate
 */
function buildDualDates(userTransactionDate) {
  const now = new Date();
  const entryDate = now.toISOString();

  let transactionDate;
  if (userTransactionDate instanceof Date) {
    transactionDate = userTransactionDate.toISOString();
  } else if (typeof userTransactionDate === 'string') {
    // Assume the string is either ISO or a parsable date
    const parsed = new Date(userTransactionDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('INVALID_TRANSACTION_DATE');
    }
    transactionDate = parsed.toISOString();
  } else {
    throw new Error('TRANSACTION_DATE_REQUIRED');
  }

  return {
    transactionDate,
    entryDate,
  };
}

/**
 * Central unified transaction executor.
 *
 * Responsibilities:
 * - Validation (financial + domain)
 * - Dual dating (transactionDate vs entryDate)
 * - Delegating to a DB-transaction wrapper for true atomicity
 * - Auto cache invalidation via `invalidateRelated`
 *
 * The actual DB atomicity MUST be implemented inside the provided
 * `runInTransaction` function, which should:
 *   - start a DB transaction
 *   - execute all required inserts/updates
 *   - commit on success / rollback on error
 *
 * @param {object} params
 * @param {string} params.kind - logical operation, e.g. 'sales:invoice:create'
 * @param {object} params.payload - transaction data from the UI / caller
 * @param {function} params.runInTransaction - async function that receives `{ payload, transactionDate, entryDate }`
 *                                            and performs the actual DB work atomically.
 * @param {string} [params.cacheSourceKey] - key used with `invalidateRelated`, defaults to `kind`.
 * @returns {Promise<{ result: any, transactionDate: string, entryDate: string }>}
 */
export async function unifiedTransaction({
  kind,
  payload,
  runInTransaction,
  cacheSourceKey,
}) {
  if (!kind || typeof kind !== 'string') {
    throw new Error('TRANSACTION_KIND_REQUIRED');
  }
  if (typeof runInTransaction !== 'function') {
    throw new Error('RUN_IN_TRANSACTION_REQUIRED');
  }

  // 1) Validation
  validateTransactionPayload(kind, payload);

  // 2) Dual dates
  const rawTransactionDate = payload.transactionDate || payload.date;
  const { transactionDate, entryDate } = buildDualDates(rawTransactionDate);

  // 3) Execute atomic DB operation
  let result;
  try {
    result = await runInTransaction({
      payload,
      transactionDate,
      entryDate,
    });
  } catch (error) {
    // Any error means the transaction MUST be considered failed.
    // `runInTransaction` is responsible for DB rollback.
    throw error;
  }

  // 4) Auto-caching: invalidate related keys AFTER a successful commit
  // If cache invalidation fails, we should not corrupt the financial outcome,
  // so errors here are intentionally swallowed / logged (if logger exists).
  try {
    const sourceKey = cacheSourceKey || kind;
    invalidateRelated(sourceKey);
  } catch {
    // Optionally integrate with a centralized logger in the future.
  }

  return {
    result,
    transactionDate,
    entryDate,
  };
}

