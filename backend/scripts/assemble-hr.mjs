import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hrDir = path.join(__dirname, '../src/hr');
const read = (f) => fs.readFileSync(path.join(hrDir, f), 'utf8');

/**
 * ملاحظة: hr-payroll لم يَعُد يُجمَّع من _gen — الصيانة اليدوية فقط
 * (hr-payroll.service.ts + hr-payroll-run-*.ts + hr-payroll-ancillary + utils).
 * انظر: hr/split-hr-services.mjs إن وُجد لحالة سابقة.
 */

const leaveHeader = `/**
 * HrLeaveService — الإجازات وتسويات راتب الإجازة
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateLeaveDto, UpdateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import type { ReturnFromLeaveDto } from './dto/return-from-leave.dto';
import type { IssueLeaveSalarySettlementDto } from './dto/issue-leave-salary-settlement.dto';
import { toMoneyDecimal2 } from '../common/utils/money-decimal';
import { computeCalendarLeaveSalarySettlement } from './utils/leave-salary-settlement.util';
import { assertVaultsUsableForPayment } from '../vaults/assert-vaults-for-payment.util';
import {
  saudiDateYmd,
  dateToSaudiYmd,
  isSaudiYmdInLeaveRange,
  daysInclusiveBetweenSaudiYmd,
} from './utils/hr-saudi-dates.util';

@Injectable()
export class HrLeaveService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly financialCore: FinancialCoreService,
  ) {}

`;

const resHeader = `/**
 * HrResidencyService — أرقام الإقامات
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateResidencyDto } from './dto/create-residency.dto';
import type { UpdateResidencyDto } from './dto/update-residency.dto';

@Injectable()
export class HrResidencyService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

`;

const docHeader = `/**
 * HrDocumentService — مستندات الموظف
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class HrDocumentService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
  ) {}

`;

let lBody = read('_gen/hr-leave.body.txt');
lBody = lBody
  .replace(/this\.saudiDateYmd\(\)/g, 'saudiDateYmd()')
  .replace(/this\.isSaudiYmdInLeaveRange\(/g, 'isSaudiYmdInLeaveRange(')
  .replace(/this\.dateToSaudiYmd\(/g, 'dateToSaudiYmd(')
  .replace(/this\.daysInclusiveBetweenSaudiYmd\(/g, 'daysInclusiveBetweenSaudiYmd(');

const rBody = read('_gen/hr-res.body.txt').replace(/^\s*\n/, '');
const dBody = read('_gen/hr-doc.body.txt').replace(/^\s*\n/, '');

const leaveOut = leaveHeader + lBody + '\n}\n';
const resOut = resHeader + rBody + '\n}\n';
const docOut = docHeader + dBody + '\n}\n';

fs.writeFileSync(path.join(hrDir, 'hr-leave.service.ts'), leaveOut, 'utf8');
fs.writeFileSync(path.join(hrDir, 'hr-residency.service.ts'), resOut, 'utf8');
fs.writeFileSync(path.join(hrDir, 'hr-document.service.ts'), docOut, 'utf8');
console.log('Wrote 3 service files (leave, residency, document) — skipped hr-payroll (modular)');