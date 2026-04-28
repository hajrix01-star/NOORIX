import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  mergeInsightThresholds,
  validateInsightThresholds,
  type CompanyInsightThresholdsPartialOverride,
  type CompanyInsightThresholdsPayload,
} from './company-insight-thresholds';

/**
 * Reads and updates per-company insight threshold overrides (JSON partials merged with generic defaults).
 */
@Injectable()
export class CompanyInsightThresholdSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolved thresholds = generic defaults merged with stored JSON overrides.
   * Companies without a row behave exactly like mergeInsightThresholds(undefined).
   */
  async getResolvedThresholds(companyId: string): Promise<CompanyInsightThresholdsPayload> {
    const row = await this.prisma.companyInsightSettings.findUnique({
      where: { companyId },
      select: { thresholds: true },
    });
    return mergeInsightThresholds(this.parseOverrides(row?.thresholds));
  }

  /**
   * Merges PATCH into stored partial overrides, validates the resolved payload, then upserts.
   */
  async updateStoredThresholds(
    companyId: string,
    patch: CompanyInsightThresholdsPartialOverride,
  ): Promise<CompanyInsightThresholdsPayload> {
    const row = await this.prisma.companyInsightSettings.findUnique({
      where: { companyId },
      select: { thresholds: true },
    });
    const existing = this.parseOverrides(row?.thresholds);
    const mergedPatch = this.mergePartialOverrides(existing, patch);
    const resolved = mergeInsightThresholds(mergedPatch);
    validateInsightThresholds(resolved);

    const json = mergedPatch as unknown as Prisma.InputJsonValue;
    await this.prisma.companyInsightSettings.upsert({
      where: { companyId },
      create: { companyId, thresholds: json },
      update: { thresholds: json },
    });

    return resolved;
  }

  /**
   * Clears stored overrides; subsequent reads resolve to generic defaults only.
   */
  async resetStoredThresholds(companyId: string): Promise<CompanyInsightThresholdsPayload> {
    await this.prisma.companyInsightSettings.deleteMany({ where: { companyId } });
    return mergeInsightThresholds(undefined);
  }

  private parseOverrides(raw: unknown): CompanyInsightThresholdsPartialOverride | null {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    return raw as CompanyInsightThresholdsPartialOverride;
  }

  private mergePartialOverrides(
    base: CompanyInsightThresholdsPartialOverride | null | undefined,
    patch: CompanyInsightThresholdsPartialOverride,
  ): CompanyInsightThresholdsPartialOverride {
    const out: CompanyInsightThresholdsPartialOverride = { ...(base ?? {}) };
    if (patch.purchaseToSales) {
      out.purchaseToSales = { ...out.purchaseToSales, ...patch.purchaseToSales };
    }
    if (patch.expenseToSales) {
      out.expenseToSales = { ...out.expenseToSales, ...patch.expenseToSales };
    }
    if (patch.netProfitMargin) {
      out.netProfitMargin = { ...out.netProfitMargin, ...patch.netProfitMargin };
    }
    return out;
  }
}
