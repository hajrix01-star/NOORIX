import { useMemo } from 'react';
import { useApiListQuery } from '../../../../hooks/useApiQuery';
import {
  bankStatementTreeCategoriesList,
  bankStatementClassificationRulesList,
} from '../../../../services/api';
import { bankKeys } from '../../../../services/queryKeys';
import { normClassifications } from '../utils/bankCategoryTreeNormalize';

export type CompanyOption = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  name?: string | null;
};

export type MigrateGroup = {
  categoryName: string;
  transactionType: string | null;
  transactionSide: string;
  keywords: string[];
};

/**
 * استعلامات الشجرة + القواعد المسطّحة والاشتقاقات — نفس المنطق السابق.
 */
export function useBankCategoryTreeData(
  companyId: string | undefined,
  companies: CompanyOption[],
  t: (k: string, ...args: string[]) => string,
) {
  const otherCompanies = useMemo(
    () => (companies || []).filter((c) => c.id && c.id !== companyId),
    [companies, companyId],
  );

  const treeKey = bankKeys.treeCategories(companyId ?? '');
  const { data: categories = [], isLoading } = useApiListQuery<any>({
    queryKey: treeKey,
    queryFn: () => bankStatementTreeCategoriesList(companyId || ''),
    enabled: !!companyId,
    fallbackMessage: 'فشل التحميل',
  });

  const { data: flatRules = [] } = useApiListQuery<any>({
    queryKey: bankKeys.classificationRules(companyId ?? ''),
    queryFn: () => bankStatementClassificationRulesList(companyId || ''),
    enabled: !!companyId,
    fallbackMessage: 'فشل التحميل',
  });

  const activeFlat = useMemo(
    () => (flatRules as Array<{ isActive?: boolean }>).filter((r) => r.isActive !== false),
    [flatRules],
  );

  const sortedCategories = useMemo(
    () =>
      [...categories].filter((c: { isActive?: boolean }) => c.isActive !== false).sort(
        (a: { sortOrder?: number }, b: { sortOrder?: number }) =>
          (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
      ),
    [categories],
  );

  const inactiveCategories = useMemo(
    () => (categories as Array<{ isActive?: boolean }>).filter((c) => c.isActive === false),
    [categories],
  );

  const totalKeywords = useMemo(() => {
    return (categories as unknown[]).reduce((sum: number, c: unknown) => {
      const cls = normClassifications((c as { classifications?: unknown }).classifications);
      return sum + cls.reduce((s, cl) => s + (cl.keywords?.length || 0), 0);
    }, 0);
  }, [categories]);

  const totalClassifications = useMemo(() => {
    return (categories as unknown[]).reduce(
      (sum: number, c: unknown) =>
        sum + normClassifications((c as { classifications?: unknown }).classifications).length,
      0,
    );
  }, [categories]);

  const groupedForMigrate = useMemo(() => {
    const groups: Record<string, MigrateGroup> = {};
    for (const rule of activeFlat as Array<{
      categoryName?: string;
      transactionType?: string | null;
      transactionSide?: string;
      keyword?: string;
    }>) {
      const cat = rule.categoryName || t('bankTreeUncategorized');
      if (!groups[cat]) {
        groups[cat] = {
          categoryName: cat,
          transactionType: rule.transactionType || null,
          transactionSide: rule.transactionSide || 'any',
          keywords: [],
        };
      }
      if (rule.keyword) groups[cat].keywords.push(String(rule.keyword).toLowerCase());
    }
    return Object.values(groups);
  }, [activeFlat, t]);

  return {
    treeKey,
    categories,
    isLoading,
    flatRules,
    activeFlat,
    sortedCategories,
    inactiveCategories,
    totalKeywords,
    totalClassifications,
    groupedForMigrate,
    otherCompanies,
  };
}
