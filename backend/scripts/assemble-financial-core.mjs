/**
 * يقسّم financial-core.service.ts إلى: outflow, inflow, transfer, cancel, support + واجهة
 * node scripts/assemble-financial-core.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fcdir = path.join(__dirname, '../src/financial-core');
const monolithPath = path.join(fcdir, 'financial-core.service.monolith.ts');
const fc = path.join(fcdir, 'financial-core.service.ts');
const persistUtil = path.join(fcdir, 'financial-outflow-persist.util.ts');
const ledgerUtil = path.join(fcdir, 'financial-outflow-ledger.util.ts');
if (fs.existsSync(persistUtil)) {
  console.warn('[assemble-financial-core] يوجد financial-outflow-persist.util.ts — دمج create/دفعة في monolith قبل التجميع إن لزم.');
}
if (fs.existsSync(ledgerUtil)) {
  console.warn(
    '[assemble-financial-core] يوجد financial-outflow-ledger.util.ts — بعد التجميع من الـ monolith، أعد دمج استدعاءات replaceOutflowInvoiceLedgerAndAllocations/scaleVaultAllocationsToTotal في financial-outflow.service.ts إن لزم.',
  );
}
const inflowChUtil = path.join(fcdir, 'financial-inflow-channels.util.ts');
if (fs.existsSync(inflowChUtil)) {
  console.warn(
    '[assemble-financial-core] يوجد financial-inflow-channels.util.ts / financial-inflow-ledger.util.ts — أعد دمج المنطق المقابل في الـ monolith أو في الملفات المُولَّدة بعد التجميع.',
  );
}
const src = fs.existsSync(monolithPath) ? monolithPath : fc;
const L = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n').split('\n');

const inflowH = L.findIndex((l) => l.includes('2. INFLOW —'));
const transferH = L.findIndex((l) => l.includes('3. TRANSFER —'));
const cancelH = L.findIndex((l) => l.includes('4. CANCEL —'));
const withRetryH = L.findIndex((l) => l.trim().startsWith('private async _withRetry<T>'));

if (inflowH < 0 || transferH < 0 || cancelH < 0 || withRetryH < 0) {
  console.error('Could not find section markers', { inflowH, transferH, cancelH, withRetryH });
  process.exit(1);
}

const outflowH = L.findIndex((l) => l.trim().startsWith('async processOutflow('));
if (outflowH < 0) {
  console.error('processOutflow not found');
  process.exit(1);
}

const outflowBody = L.slice(outflowH, inflowH).join('\n');
const inflowBody = L.slice(inflowH, transferH).join('\n');
const transferBody = L.slice(transferH, cancelH).join('\n');
const cancelBody = L.slice(cancelH, withRetryH).join('\n');
let endSupport = L.length;
while (endSupport > 0 && L[endSupport - 1].trim() === '') endSupport -= 1;
if (L[endSupport - 1].trim() === '}') endSupport -= 1;
const supportBodyRaw = L.slice(withRetryH, endSupport).join('\n');
let supportBody = supportBodyRaw;

const wire = (b) => {
  let s = b;
  s = s
    .replace(/this\._withRetry\(/g, 'this.support.withRetry(')
    .replace(/this\._resolveUserId\(/g, 'this.support.resolveUserId(')
    .replace(/this\._resolveTenantId\(/g, 'this.support.resolveTenantId(')
    .replace(/this\._buildDates\(/g, 'this.support.buildDates(')
    .replace(/this\._invoiceSnapshot\(/g, 'this.support.invoiceSnapshot(')
    .replace(/this\._assertVaultsUsableAsSalesPayment\(/g, 'this.support.assertVaultsUsableAsSalesPayment(')
    .replace(/this\._resolveOutflowVaultSplits\(/g, 'this.support.resolveOutflowVaultSplits(')
    .replace(/this\._assertVaultTransferEndpoints\(/g, 'this.support.assertVaultTransferEndpoints(')
    .replace(/this\._assertVaultUsableForPaymentOutflow\(/g, 'this.support.assertVaultUsableForPaymentOutflow(')
    .replace(/this\._getVaultAccount\(/g, 'this.support.getVaultAccount(')
    .replace(/this\._getDefaultExpenseAccount\(/g, 'this.support.getDefaultExpenseAccount(')
    .replace(/this\._getDefaultRevenueAccount\(/g, 'this.support.getDefaultRevenueAccount(')
    .replace(/this\._getVatCollectedAccount\(/g, 'this.support.getVatCollectedAccount(')
    .replace(/FinancialCoreService\.KIND_TO_ACCOUNT_CODE/g, 'FinancialCoreSupportService.KIND_TO_ACCOUNT_CODE');
  return s;
};

supportBody = supportBody
  .replace(/private static readonly KIND_TO_ACCOUNT_CODE/g, 'static readonly KIND_TO_ACCOUNT_CODE')
  .replace(/private async _withRetry/g, 'async withRetry')
  .replace(/private async _assertVaultsUsableAsSalesPayment/g, 'async assertVaultsUsableAsSalesPayment')
  .replace(/private async _resolveOutflowVaultSplits/g, 'async resolveOutflowVaultSplits')
  .replace(/private async _assertVaultTransferEndpoints/g, 'async assertVaultTransferEndpoints')
  .replace(/private async _assertVaultUsableForPaymentOutflow/g, 'async assertVaultUsableForPaymentOutflow')
  .replace(/private async _getVaultAccount/g, 'async getVaultAccount')
  .replace(/private async _getDefaultExpenseAccount/g, 'async getDefaultExpenseAccount')
  .replace(/private async _getDefaultRevenueAccount/g, 'async getDefaultRevenueAccount')
  .replace(/private async _getVatCollectedAccount/g, 'async getVatCollectedAccount')
  .replace(/private _resolveUserId\(/g, 'resolveUserId(')
  .replace(/private _resolveTenantId\(/g, 'resolveTenantId(')
  .replace(/private _buildDates\(/g, 'buildDates(')
  .replace(/private _invoiceSnapshot\(/g, 'invoiceSnapshot(')
  .replace(/FinancialCoreService\.KIND_TO_ACCOUNT_CODE/g, 'FinancialCoreSupportService.KIND_TO_ACCOUNT_CODE');
supportBody = supportBody.replace(
  /this\._assertVaultUsableForPaymentOutflow\(/g,
  'this.assertVaultUsableForPaymentOutflow(',
);

const outflowW = wire(outflowBody);
const inflowW = wire(inflowBody);
const transferW = wire(transferBody);
const cancelW = wire(cancelBody);

const outHeader = `/**
 * صرف: processOutflow، الدفعة، وإعادة بناء قيود الفواتير.
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { generateInvoiceSerial } from '../common/utils/invoice-serial';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  assertOperationNotesLength,
  validateJournalBalance,
  type JsonObject,
} from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { OutflowDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialOutflowService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly support: FinancialCoreSupportService,
  ) {}

`;

const inflowHeader = `/**
 * دخل: الملخصات اليومية (processInflow، updateInflow)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { splitTax } from '../common/utils/math-engine';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  assertOperationNotesLength,
  validateJournalBalance,
  type JsonObject,
} from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { InflowDto, SalesChannelDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialInflowService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly support: FinancialCoreSupportService,
  ) {}

`;

const transferHeader = `/**
 * تحويل نقدي بين خزنات
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { VaultBalanceService } from '../vault-balance/vault-balance.service';
import { assertOperationNotesLength, validateJournalBalance } from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { TransferDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialTransferService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly vaultBalance: VaultBalanceService,
    private readonly support: FinancialCoreSupportService,
  ) {}

`;

const cancelHeader = `/**
 * إلغاء فاتورة/ملخص مبيعات (بدون حذف)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { nowSaudi } from '../common/utils/date-utils';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { CancelOperationDto } from './dto/financial-operation.dto';
import type { JsonObject } from './financial-core-helpers.util';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialCancelService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly support: FinancialCoreSupportService,
  ) {}

`;

const supHeader = `/**
 * دعم مشترك: إعادة محاولة، تسوية خزنات/حسابات، ومساعدات المستخدم/السياق
 */
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { nowSaudi } from '../common/utils/date-utils';
import { sleep, getRetryDelayMs, RETRY_MAX, type JsonObject, type TxClient } from './financial-core-helpers.util';
import { OutflowDto } from './dto/financial-operation.dto';

@Injectable()
export class FinancialCoreSupportService {

`;

fs.writeFileSync(path.join(fcdir, 'financial-core-support.service.ts'), supHeader + supportBody + '\n}\n', 'utf8');
fs.writeFileSync(path.join(fcdir, 'financial-outflow.service.ts'), outHeader + outflowW + '\n}\n', 'utf8');
fs.writeFileSync(path.join(fcdir, 'financial-inflow.service.ts'), inflowHeader + inflowW + '\n}\n', 'utf8');
fs.writeFileSync(path.join(fcdir, 'financial-transfer.service.ts'), transferHeader + transferW + '\n}\n', 'utf8');
fs.writeFileSync(path.join(fcdir, 'financial-cancel.service.ts'), cancelHeader + cancelW + '\n}\n', 'utf8');

const facade = `/**
 * واجهة المحرك المالي — تفوّض إلى outflow / inflow / transfer / cancel
 */
import { Injectable } from '@nestjs/common';
import { FinancialOutflowService } from './financial-outflow.service';
import { FinancialInflowService } from './financial-inflow.service';
import { FinancialTransferService } from './financial-transfer.service';
import { FinancialCancelService } from './financial-cancel.service';
@Injectable()
export class FinancialCoreService {
  constructor(
    private readonly outflow: FinancialOutflowService,
    private readonly inflow: FinancialInflowService,
    private readonly transfer: FinancialTransferService,
    private readonly cancel: FinancialCancelService,
  ) {}

  processOutflow(...a: Parameters<FinancialOutflowService['processOutflow']>) {
    return this.outflow.processOutflow(...a);
  }
  processOutflowBatch(...a: Parameters<FinancialOutflowService['processOutflowBatch']>) {
    return this.outflow.processOutflowBatch(...a);
  }
  rebuildOutflowInvoiceLedgerAfterVaultChange(
    ...a: Parameters<FinancialOutflowService['rebuildOutflowInvoiceLedgerAfterVaultChange']>
  ) {
    return this.outflow.rebuildOutflowInvoiceLedgerAfterVaultChange(...a);
  }
  rebuildOutflowInvoiceLedgerToMatchInvoice(
    ...a: Parameters<FinancialOutflowService['rebuildOutflowInvoiceLedgerToMatchInvoice']>
  ) {
    return this.outflow.rebuildOutflowInvoiceLedgerToMatchInvoice(...a);
  }
  processInflow(...a: Parameters<FinancialInflowService['processInflow']>) {
    return this.inflow.processInflow(...a);
  }
  updateInflow(
    id: string,
    companyId: string,
    dto: Parameters<FinancialInflowService['updateInflow']>[2],
    userId?: string,
  ) {
    return this.inflow.updateInflow(id, companyId, dto, userId);
  }
  processTransfer(...a: Parameters<FinancialTransferService['processTransfer']>) {
    return this.transfer.processTransfer(...a);
  }
  cancelOperation(...a: Parameters<FinancialCancelService['cancelOperation']>) {
    return this.cancel.cancelOperation(...a);
  }
}
`;
fs.writeFileSync(path.join(fcdir, 'financial-core.service.ts'), facade, 'utf8');
console.log('Wrote financial split + facade (lines:', L.length, ')');