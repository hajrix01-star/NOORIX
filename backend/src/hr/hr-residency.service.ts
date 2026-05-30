/**
 * HrResidencyService — خدمات الموظف (إقامات، تأشيرات، تذاكر، تأمين)
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { TenantContext } from '../common/tenant-context';
import type { CreateResidencyDto } from './dto/create-residency.dto';
import type { UpdateResidencyDto } from './dto/update-residency.dto';
import type { IssueResidencyInvoiceDto } from './dto/issue-residency-invoice.dto';
import type { ResidencyIssueInvoiceInlineDto } from './dto/create-residency-with-invoice.dto';
import {
  requiresIqamaNumber,
  serviceCategoryLabelAr,
} from './constants/employee-hr-service-categories';
import { issueResidencyServiceInvoiceCore } from './hr-residency-issue-invoice.util';

const residencyInclude = {
  employee: true,
  invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
} as const;

@Injectable()
export class HrResidencyService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditLogService,
    private readonly financialCore: FinancialCoreService,
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
    dto: { iqamaNumber?: string; expiryDate?: string; referenceLabel?: string },
  ) {
    if (requiresIqamaNumber(category) && !dto.iqamaNumber?.trim()) {
      throw new BadRequestException('رقم الإقامة مطلوب لهذا النوع من الخدمة.');
    }
    const needsExpiry = [
      'iqama_new',
      'iqama_renewal',
      'sponsorship_transfer',
      'exit_reentry_visa',
      'medical_insurance',
    ].includes(category);
    if (needsExpiry && !dto.expiryDate) {
      throw new BadRequestException('تاريخ الانتهاء مطلوب لهذا النوع من الخدمة.');
    }
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

  async createResidency(
    dto: CreateResidencyDto,
    userId?: string,
    issueInvoice?: ResidencyIssueInvoiceInlineDto,
  ) {
    const category = dto.serviceCategory ?? 'iqama_renewal';
    this.validateServicePayload(category, dto);

    const tenantId = TenantContext.getTenantId();
    const dates = this.mapDateFields(dto);

    const residency = await this.prisma.employeeResidency.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        serviceCategory: category,
        iqamaNumber: dto.iqamaNumber?.trim() || null,
        referenceLabel: dto.referenceLabel?.trim() || null,
        ...dates,
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
        { prisma: this.prisma, financialCore: this.financialCore },
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
    this.validateServicePayload(category, {
      iqamaNumber: dto.iqamaNumber ?? existing.iqamaNumber ?? undefined,
      expiryDate: dto.expiryDate ?? existing.expiryDate?.toISOString(),
      referenceLabel: dto.referenceLabel ?? existing.referenceLabel ?? undefined,
    });

    const dates = this.mapDateFields({
      issueDate: dto.issueDate,
      expiryDate: dto.expiryDate,
      transactionDate: dto.transactionDate,
    });

    const updated = await this.prisma.employeeResidency.update({
      where: { id },
      data: {
        ...(dto.serviceCategory !== undefined && { serviceCategory: dto.serviceCategory }),
        ...(dto.iqamaNumber !== undefined && { iqamaNumber: dto.iqamaNumber?.trim() || null }),
        ...(dto.referenceLabel !== undefined && { referenceLabel: dto.referenceLabel?.trim() || null }),
        ...(dto.issueDate !== undefined && { issueDate: dates.issueDate }),
        ...(dto.expiryDate !== undefined && { expiryDate: dates.expiryDate }),
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
      { prisma: this.prisma, financialCore: this.financialCore },
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

  async deleteResidency(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.employeeResidency.findFirst({
      where: { id, companyId },
      include: { invoice: true },
    });
    if (!existing) throw new NotFoundException(`السجل ${id} غير موجود.`);

    if (existing.invoiceId && existing.invoice?.status === 'active') {
      throw new BadRequestException(
        'لا يمكن حذف سجل مرتبط بفاتورة نشطة. ألغِ الفاتورة أولاً أو ألغِ السجل محاسبياً.',
      );
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
