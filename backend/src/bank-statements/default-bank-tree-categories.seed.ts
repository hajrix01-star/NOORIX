/**
 * قواعد تصنيف كشف الحساب الافتراضية — مستوردة من النظام السابق (تصدير 2026-03-29).
 * تُزرع لكل شركة جديدة عبر AccountingInit؛ يمكن إعادة استدعائها من الواجهة إذا كانت الفئات فارغة.
 *
 * transactionSide: يحدد أي حركات تُطابق الفئة (any | debit | credit)
 */
export type BankTreeCategorySeed = {
  name: string;
  transactionType: string | null;
  transactionSide: 'any' | 'debit' | 'credit';
  sortOrder: number;
  isActive: boolean;
  parentKeywords: string[];
  classifications: { name: string; keywords: string[] }[];
};

export const DEFAULT_BANK_TREE_CATEGORY_SEEDS: BankTreeCategorySeed[] = [
  {
    name: 'رسوم بنكية',
    transactionType: 'bank_fee',
    transactionSide: 'debit',
    sortOrder: 10,
    isActive: true,
    parentKeywords: [],
    classifications: [
      {
        name: 'عمولات POS رسوم تحويل',
        keywords: ['commission', 'عمولة', 'رسوم', 'fee', 'charge'],
      },
    ],
  },
  {
    name: 'فواتير سداد',
    transactionType: 'government',
    transactionSide: 'debit',
    sortOrder: 20,
    isActive: true,
    parentKeywords: [],
    classifications: [
      { name: 'سداد', keywords: ['sadad', 'سداد'] },
      { name: 'كهرباء', keywords: ['كهرباء', 'sec', 'electricity'] },
      { name: 'اتصالات', keywords: ['stc', 'زين', 'mobily', 'اتصالات'] },
      { name: 'مياه', keywords: ['مياه', 'water'] },
      { name: 'رسوم حكومية', keywords: ['iqama'] },
    ],
  },
  {
    name: 'رواتب',
    transactionType: 'expense',
    transactionSide: 'debit',
    sortOrder: 30,
    isActive: true,
    parentKeywords: [],
    classifications: [
      {
        name: 'رواتب',
        keywords: ['راتب', 'salary', 'أجور', 'payroll', 'رشيد'],
      },
    ],
  },
  {
    name: 'عهدة مشتريات',
    transactionType: 'supplier',
    transactionSide: 'debit',
    sortOrder: 40,
    isActive: true,
    parentKeywords: [],
    classifications: [
      {
        name: 'بتي كاش',
        keywords: ['بتي كاش', 'petty cash', 'فايز', 'الهاجري', 'مطعم مشويات المعلم'],
      },
      {
        name: 'مندوب',
        keywords: ['مندوب المشتريات', 'مشتريات'],
      },
    ],
  },
  {
    name: 'مخالفات',
    transactionType: 'government',
    transactionSide: 'debit',
    sortOrder: 50,
    isActive: true,
    parentKeywords: [],
    classifications: [
      {
        name: 'مخالفات',
        keywords: ['ديوان المظالم', 'مخالفة', 'مرورية'],
      },
    ],
  },
  {
    name: 'تحويلات',
    transactionType: 'transfer',
    transactionSide: 'any',
    sortOrder: 60,
    isActive: true,
    parentKeywords: [],
    classifications: [
      { name: 'تحويل فوري', keywords: ['ips', 'تحويل فوري'] },
      { name: 'تحويل عادي', keywords: ['حوالة', 'تحويل', 'transfer'] },
    ],
  },
  {
    name: 'إيرادات نقاط البيع',
    transactionType: 'revenue',
    transactionSide: 'credit',
    sortOrder: 70,
    isActive: true,
    parentKeywords: [],
    classifications: [
      { name: 'نقاط بيع', keywords: ['term', 'p1 term', 'pos'] },
      { name: 'فيزا/ماستر', keywords: ['vc term', 'mc term'] },
    ],
  },
  {
    name: 'قرضي',
    transactionType: 'expense',
    transactionSide: 'debit',
    sortOrder: 90,
    isActive: true,
    parentKeywords: [],
    classifications: [{ name: 'قرض', keywords: ['msb delinquency'] }],
  },
];
