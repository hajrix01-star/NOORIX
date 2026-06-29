/**
 * HrResidencyService — خدمات الموظف (إقامات، تأشيرات، تذاكر، تأمين)
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateResidencyDto } from './dto/create-residency.dto';
import type { UpdateResidencyDto } from './dto/update-residency.dto';
import type { IssueResidencyInvoiceDto } from './dto/issue-residency-invoice.dto';
import type { ResidencyIssueInvoiceInlineDto } from './dto/create-residency-with-invoice.dto';
import {
  requiresIqamaNumber,
  serviceCategoryLabelAr,
  usesCompanyAsSponsor,
  companySponsorNameFromRecord,
  requiresExpiryDate,
  requiresVisaDurationMonths,
  formatVisaDurationReferenceAr,
} from './constants/employee-hr-service-categories';
import { issueResidencyServiceInvoiceCore } from './hr-residency-issue-invoice.util';
import { voidResidencyServiceInvoiceCore } from './hr-residency-void-invoice.util';

const residencyInclude = {
  employee: true,
  invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
} as const;

@Injectable()
export class HrResidencyService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly accountingCore: AccountingCoreService,
  ) {}

  async findResidencies(companyId: string, employeeId?: string, serviceCategory?: string) {
    const where: Prisma.EmployeeResidencyWhereInput = { companyId };
    if (employeeId) where.employeeId = employeeId;
    if (serviceCategory) where.serviceCategory = serviceCategory;
    return this.prisma.employeeResidency.findMany({
      where,
      include: residencyInclude,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  private validateServicePayload(
    category: string,
    dto: { iqamaNumber?: string; expiryDate?: string; visaDurationMonths?: number },
  ) {
    if (requiresIqamaNumber(category) && !dto.iqamaNumber?.trim()) {
      throw new BadRequestException('رقم الإقامة مطلوب لهذا النوع من الخدمة.');
    }
    if (requiresExpiryDate(category) && !dto.expiryDate) {
      throw new BadRequestException('تاريخ الانتهاء مطلوب لهذا النوع من الخدمة.');
    }
    if (requiresVisaDurationMonths(category)) {
      const m = dto.visaDurationMonths;
      if (m == null || m < 1 || m > 5) {
        throw new BadRequestException('مدة التأشيرة مطلوبة (من شهر إلى 5 أشهر).');
      }
    }
  }

  private showsIssueDate(category: string): boolean {
    return ['iqama_new', 'iqama_renewal', 'medical_insurance'].includes(category);
  }

  private async prepareCategoryFields(
    companyId: string,
    category: string,
    dto: { referenceLabel?: string; visaDurationMonths?: number },
    dates: { issueDate: Date | null; expiryDate: Date | null },
  ): Promise<{
    referenceLabel: string | null;
    metadata: Prisma.InputJsonValue | null;
    issueDate: Date | null;
    expiryDate: Date | null;
  }> {
    if (usesCompanyAsSponsor(category)) {
      return {
        referenceLabel: await this.resolveReferenceLabel(companyId, category, dto.referenceLabel),
        metadata: null,
        issueDate: null,
        expiryDate: null,
      };
    }
    if (requiresVisaDurationMonths(category)) {
      const months = dto.visaDurationMonths!;
      return {
        referenceLabel: formatVisaDurationReferenceAr(months),
        metadata: { visaDurationMonths: months },
        issueDate: null,
        expiryDate: null,
      };
    }
    return {
      referenceLabel: dto.referenceLabel?.trim() || null,
      metadata: null,
      issueDate: this.showsIssueDate(category) ? dates.issueDate : null,
      expiryDate: requiresExpiryDate(category) ? dates.expiryDate : null,
    };
  }

  private mapDateFields(dto: {
    issueDate?: string;
    expiryDate?: string;
    transactionDate?: string;
  }) {
    return {
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : null,
    };
  }

  /** نقل الكفالة — الكفيل الجديد = اسم الشركة التي يعمل بها الموظف */
  private async resolveReferenceLabel(
    companyId: string,
    category: string,
    referenceLabel?: string,
  ): Promise<string | null> {
    if (!usesCompanyAsSponsor(category)) {
      return referenceLabel?.trim() || null;
    }
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { nameAr: true, nameEn: true },
    });
    if (!company) throw new BadRequestException('الشركة غير موجودة.');
    return companySponsorNameFromRecord(company) || null;
  }

  async createResidency(
    dto: CreateResidencyDto,
    userId?: string,
    issueInvoice?: ResidencyIssueInvoiceInlineDto,
  ) {
    const category = dto.serviceCategory ?? 'iqama_renewal';
    this.validateServicePayload(category, dto);

    const tenantId = TenantContext.getTenantId();
    const dates = this.mapDateFields(dto);
    const prepared = await this.prepareCategoryFields(dto.companyId, category, dto, {
      issueDate: dates.issueDate,
      expiryDate: dates.expiryDate,
    });

    const residency = await this.prisma.employeeResidency.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        serviceCategory: category,
        iqamaNumber: dto.iqamaNumber?.trim() || null,
        referenceLabel: prepared.referenceLabel,
        metadata: prepared.metadata ?? undefined,
        issueDate: prepared.issueDate,
        expiryDate: prepared.expiryDate,
        transactionDate: dates.transactionDate,
        status: dto.status ?? 'active',
        notes: dto.notes,
      },
      include: residencyInclude,
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'create',
      entity: 'employee_residency',
      entityId: residency.id,
      newValue: { serviceCategory: category, iqamaNumber: residency.iqamaNumber },
    });

    if (issueInvoice) {
      await issueResidencyServiceInvoiceCore(
        { prisma: this.prisma, accountingCore: this.accountingCore },
        residency,
        userId ?? '',
        {
          amount: issueInvoice.amount,
          vaultId: issueInvoice.vaultId,
          transactionDate: dto.transactionDate,
        },
      );
      return this.prisma.employeeResidency.findFirst({
        where: { id: residency.id },
        include: residencyInclude,
      });
    }

    return residency;
  }

  async updateResidency(
    id: string,
    dto: UpdateResidencyDto,
    companyId: string,
    userId?: string,
  ) {
    const existing = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException(`السجل ${id} غير موجود.`);

    const category = dto.serviceCategory ?? existing.serviceCategory;
    const existingMeta = (existing.metadata ?? {}) as Record<string, unknown>;
    const mergedVisaMonths =
      dto.visaDurationMonths ??
      (typeof existingMeta.visaDurationMonths === 'number'
        ? existingMeta.visaDurationMonths
        : undefined);

    this.validateServicePayload(category, {
      iqamaNumber: dto.iqamaNumber ?? existing.iqamaNumber ?? undefined,
      expiryDate: dto.expiryDate ?? existing.expiryDate?.toISOString(),
      visaDurationMonths: mergedVisaMonths,
    });

    const dates = this.mapDateFields({
      issueDate: dto.issueDate,
      expiryDate: dto.expiryDate,
      transactionDate: dto.transactionDate,
    });

    const prepared = await this.prepareCategoryFields(companyId, category, {
      referenceLabel: dto.referenceLabel,
      visaDurationMonths: mergedVisaMonths,
    }, {
      issueDate: dto.issueDate !== undefined ? dates.issueDate : existing.issueDate,
      expiryDate: dto.expiryDate !== undefined ? dates.expiryDate : existing.expiryDate,
    });

    const updated = await this.prisma.employeeResidency.update({
      where: { id },
      data: {
        ...(dto.serviceCategory !== undefined && { serviceCategory: dto.serviceCategory }),
        ...(dto.iqamaNumber !== undefined && { iqamaNumber: dto.iqamaNumber?.trim() || null }),
        referenceLabel: prepared.referenceLabel,
        metadata: prepared.metadata ?? undefined,
        issueDate: prepared.issueDate,
        expiryDate: prepared.expiryDate,
        ...(dto.transactionDate !== undefined && { transactionDate: dates.transactionDate }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: residencyInclude,
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'update',
      entity: 'employee_residency',
      entityId: id,
      oldValue: { serviceCategory: existing.serviceCategory },
      newValue: { serviceCategory: updated.serviceCategory },
    });

    return updated;
  }

  async issueResidencyInvoice(
    id: string,
    dto: IssueResidencyInvoiceDto,
    userId?: string,
  ) {
    const residency = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId: dto.companyId },
      include: { employee: true },
    });
    if (!residency) throw new NotFoundException(`السجل ${id} غير موجود.`);

    const result = await issueResidencyServiceInvoiceCore(
      { prisma: this.prisma, accountingCore: this.accountingCore },
      residency,
      userId ?? '',
      {
        amount: dto.amount,
        vaultId: dto.vaultId,
        transactionDate: dto.transactionDate,
      },
    );

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action: 'update',
      entity: 'employee_residency',
      entityId: id,
      newValue: { invoiceNumber: result.invoiceNumber, category: serviceCategoryLabelAr(residency.serviceCategory) },
    });

    return this.prisma.employeeResidency.findFirst({
      where: { id },
      include: residencyInclude,
    });
  }

  async deleteResidency(
    id: string,
    companyId: string,
    userId?: string,
    voidInvoice?: boolean,
  ) {
    const existing = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId },
      include: { invoice: true },
    });
    if (!existing) throw new NotFoundException(`السجل ${id} غير موجود.`);

    if (existing.invoiceId && existing.invoice?.status === 'active') {
      if (voidInvoice) {
        await voidResidencyServiceInvoiceCore(
          {
            prisma: this.prisma,
            accountingCore: this.accountingCore,
            audit: this.audit,
          },
          id,
          companyId,
          existing.employeeId,
          existing.invoiceId,
          userId,
          'حذف سجل خدمة موظف — إلغاء الفاتورة المرتبطة بموافقة المستخدم',
        );
      } else {
        throw new BadRequestException(
          'لا يمكن حذف سجل مرتبط بفاتورة نشطة. أرسل voidInvoice=true بعد تأكيد إلغاء الفاتورة.',
        );
      }
    }

    await this.prisma.employeeResidency.delete({ where: { id } });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'employee_residency',
      entityId: id,
      oldValue: { serviceCategory: existing.serviceCategory },
    });

    return { deleted: true, id };
  }
}
