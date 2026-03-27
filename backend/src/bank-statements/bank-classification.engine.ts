/**
 * محرك تصنيف مطابق لمنطق Base44 (reclassifyBankStatement + categorizeTransaction)
 */

export type TreeClassification = { name: string; keywords: string[] };

export type BankTreeCategoryRow = {
  id: string;
  name: string;
  isActive: boolean;
  transactionSide: string;
  transactionType: string | null;
  parentKeywords: unknown;
  classifications: unknown;
};

export type BankRuleRow = {
  id: string;
  keyword: string;
  matchType: string;
  categoryName: string;
  transactionSide: string;
  transactionType: string | null;
  isActive: boolean;
  priority: number;
};

/** قواعد مدمجة عند عدم وجود فئات/قواعد في DB (تقريب سلوك القائمة الافتراضية) */
const BUILTIN_RULES: Array<{
  keyword: string;
  category: string;
  side: 'any' | 'debit' | 'credit';
  match: 'contains' | 'multi_keyword';
}> = [
  { keyword: 'سداد', category: 'فواتير سداد', side: 'any', match: 'contains' },
  { keyword: 'sadad', category: 'فواتير سداد', side: 'any', match: 'contains' },
  { keyword: 'مدى', category: 'مبيعات نقاط البيع', side: 'credit', match: 'contains' },
  { keyword: 'mada', category: 'مبيعات نقاط البيع', side: 'credit', match: 'contains' },
  { keyword: 'فوري', category: 'تحويل فوري', side: 'any', match: 'contains' },
  { keyword: 'تحويل', category: 'تحويل', side: 'any', match: 'contains' },
  { keyword: 'راتب', category: 'رواتب', side: 'debit', match: 'contains' },
  { keyword: 'salary', category: 'رواتب', side: 'debit', match: 'contains' },
  { keyword: 'إيجار', category: 'إيجار', side: 'debit', match: 'contains' },
  { keyword: 'كهرباء', category: 'كهرباء', side: 'debit', match: 'contains' },
  { keyword: 'مياه', category: 'مياه', side: 'debit', match: 'contains' },
  { keyword: 'اتصالات', category: 'اتصالات', side: 'debit', match: 'contains' },
  { keyword: 'رسوم بنكية', category: 'رسوم بنكية', side: 'debit', match: 'contains' },
  { keyword: 'ضريبة', category: 'زكاة وضريبة', side: 'debit', match: 'contains' },
  { keyword: 'زكاة', category: 'زكاة وضريبة', side: 'debit', match: 'contains' },
  { keyword: 'مورد', category: 'موردين أغذية', side: 'debit', match: 'contains' },
];

function parseClassifications(raw: unknown): TreeClassification[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => ({
      name: String((x as { name?: string }).name || ''),
      keywords: Array.isArray((x as { keywords?: string[] }).keywords)
        ? (x as { keywords: string[] }).keywords.map(String)
        : [],
    }))
    .filter((c) => c.name || c.keywords.length);
}

function parseParentKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function matchKeyword(desc: string, keyword: string, matchType: string): boolean {
  const kw = keyword.toLowerCase();
  const d = desc.toLowerCase();
  switch (matchType) {
    case 'exact':
      return d === kw;
    case 'starts_with':
      return d.startsWith(kw);
    case 'ends_with':
      return d.endsWith(kw);
    case 'multi_keyword':
      return kw
        .split('+')
        .map((k) => k.trim())
        .filter(Boolean)
        .every((k) => d.includes(k));
    case 'contains':
    default:
      return d.includes(kw);
  }
}

export function categorizeWithTree(
  description: string,
  isCredit: boolean,
  categories: BankTreeCategoryRow[],
): {
  category: string;
  transactionType: string;
  matchedKeyword: string | null;
  classificationName: string | null;
} {
  if (!description) {
    return { category: 'غير مصنف', transactionType: 'unknown', matchedKeyword: null, classificationName: null };
  }
  const desc = description.toLowerCase();

  for (const cat of categories) {
    if (!cat.isActive) continue;
    const side = cat.transactionSide || 'any';
    if (side === 'debit' && isCredit) continue;
    if (side === 'credit' && !isCredit) continue;

    const parentKeywords = parseParentKeywords(cat.parentKeywords);
    const classifications = parseClassifications(cat.classifications);

    if (parentKeywords.length > 0) {
      const parentMatched = parentKeywords.find((kw) => kw && desc.includes(kw.toLowerCase()));
      if (!parentMatched) continue;

      let subMatch: {
        category: string;
        type: string;
        matched_keyword: string;
        classification_name: string;
      } | null = null;

      for (const cl of classifications) {
        for (const kw of cl.keywords || []) {
          if (kw && desc.includes(String(kw).toLowerCase())) {
            subMatch = {
              category: cat.name,
              type: cat.transactionType || 'unknown',
              matched_keyword: kw,
              classification_name: cl.name,
            };
            break;
          }
        }
        if (subMatch) break;
      }

      if (subMatch) {
        return {
          category: subMatch.category,
          transactionType: subMatch.type,
          matchedKeyword: subMatch.matched_keyword,
          classificationName: subMatch.classification_name,
        };
      }
      return {
        category: cat.name,
        transactionType: cat.transactionType || 'unknown',
        matchedKeyword: parentMatched,
        classificationName: cat.name,
      };
    }

    for (const cl of classifications) {
      for (const kw of cl.keywords || []) {
        if (kw && desc.includes(String(kw).toLowerCase())) {
          return {
            category: cat.name,
            transactionType: cat.transactionType || 'unknown',
            matchedKeyword: kw,
            classificationName: cl.name,
          };
        }
      }
    }
  }

  return isCredit
    ? { category: 'إيرادات أخرى', transactionType: 'revenue', matchedKeyword: null, classificationName: null }
    : { category: 'مصروفات أخرى', transactionType: 'expense', matchedKeyword: null, classificationName: null };
}

export function categorizeWithOldRules(
  description: string,
  isCredit: boolean,
  rules: BankRuleRow[],
): {
  category: string;
  transactionType: string;
  matchedKeyword: string | null;
  classificationName: null;
} | null {
  if (!description || !rules.length) return null;
  const desc = description.toLowerCase();

  for (const rule of rules) {
    if (!rule.isActive || !rule.keyword) continue;
    if (!matchKeyword(desc, rule.keyword, rule.matchType || 'contains')) continue;
    const side = rule.transactionSide || 'any';
    if (side === 'debit' && isCredit) continue;
    if (side === 'credit' && !isCredit) continue;
    return {
      category: rule.categoryName,
      transactionType: rule.transactionType || 'unknown',
      matchedKeyword: rule.keyword,
      classificationName: null,
    };
  }
  return null;
}

export function categorizeWithBuiltin(description: string, isCredit: boolean) {
  if (!description) {
    return isCredit
      ? { category: 'إيرادات أخرى', transactionType: 'revenue', matchedKeyword: null, classificationName: null }
      : { category: 'مصروفات أخرى', transactionType: 'expense', matchedKeyword: null, classificationName: null };
  }
  const desc = description.toLowerCase();
  for (const r of BUILTIN_RULES) {
    if (r.side === 'debit' && isCredit) continue;
    if (r.side === 'credit' && !isCredit) continue;
    if (desc.includes(r.keyword.toLowerCase())) {
      return {
        category: r.category,
        transactionType: isCredit ? 'revenue' : 'expense',
        matchedKeyword: r.keyword,
        classificationName: null as string | null,
      };
    }
  }
  return isCredit
    ? { category: 'إيرادات أخرى', transactionType: 'revenue', matchedKeyword: null, classificationName: null }
    : { category: 'مصروفات أخرى', transactionType: 'expense', matchedKeyword: null, classificationName: null };
}

/** تصنيف نهائي: شجرة → قواعد قديمة → مدمج → افتراضي */
export function classifyTransaction(
  description: string,
  isCredit: boolean,
  tree: BankTreeCategoryRow[],
  rules: BankRuleRow[],
) {
  if (tree.length > 0) {
    return categorizeWithTree(description, isCredit, tree);
  }
  const old = categorizeWithOldRules(description, isCredit, rules);
  if (old) {
    return {
      category: old.category,
      transactionType: old.transactionType,
      matchedKeyword: old.matchedKeyword,
      classificationName: old.classificationName,
    };
  }
  if (rules.length === 0 && tree.length === 0) {
    return categorizeWithBuiltin(description, isCredit);
  }
  return isCredit
    ? { category: 'إيرادات أخرى', transactionType: 'revenue', matchedKeyword: null, classificationName: null }
    : { category: 'مصروفات أخرى', transactionType: 'expense', matchedKeyword: null, classificationName: null };
}
