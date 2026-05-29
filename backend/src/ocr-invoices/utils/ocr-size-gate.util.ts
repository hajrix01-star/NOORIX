import Decimal from 'decimal.js';

export type OcrCanonicalSizeUnit = 'L' | 'kg' | 'pcs';

export type OcrSizeGateFlag =
  | 'size_mismatch'
  | 'missing_size_for_multi_size_item'
  | 'size_missing_on_candidate'
  | 'incompatible_size_units'
  | 'possible_decimal_size_error'
  | 'size_gate_blocked_auto_match';

export type OcrSizeGateDecision = 'allow' | 'needs_review' | 'block_auto_match';

export type OcrSizeGateResult = {
  decision: OcrSizeGateDecision;
  flags: OcrSizeGateFlag[];
  query: { value: number; unit: OcrCanonicalSizeUnit } | null;
  candidate: { value: number; unit: OcrCanonicalSizeUnit } | null;
};

type OcrSizeGateOptions = {
  candidateHasSizes?: boolean;
  toleranceRatio?: Decimal.Value;
  decimalErrorRatio?: Decimal.Value;
};

type OcrUnitAlias = { canonical: OcrCanonicalSizeUnit; factor: Decimal };

const UNIT_ALIASES = new Map<string, OcrUnitAlias>([
  ['ml', { canonical: 'L', factor: new Decimal(0.001) }],
  ['مل', { canonical: 'L', factor: new Decimal(0.001) }],
  ['ملي', { canonical: 'L', factor: new Decimal(0.001) }],
  ['مليلتر', { canonical: 'L', factor: new Decimal(0.001) }],
  ['l', { canonical: 'L', factor: new Decimal(1) }],
  ['ltr', { canonical: 'L', factor: new Decimal(1) }],
  ['liter', { canonical: 'L', factor: new Decimal(1) }],
  ['litre', { canonical: 'L', factor: new Decimal(1) }],
  ['لتر', { canonical: 'L', factor: new Decimal(1) }],
  ['ليتر', { canonical: 'L', factor: new Decimal(1) }],

  ['g', { canonical: 'kg', factor: new Decimal(0.001) }],
  ['gm', { canonical: 'kg', factor: new Decimal(0.001) }],
  ['gram', { canonical: 'kg', factor: new Decimal(0.001) }],
  ['جرام', { canonical: 'kg', factor: new Decimal(0.001) }],
  ['غرام', { canonical: 'kg', factor: new Decimal(0.001) }],
  ['جم', { canonical: 'kg', factor: new Decimal(0.001) }],
  ['kg', { canonical: 'kg', factor: new Decimal(1) }],
  ['kilo', { canonical: 'kg', factor: new Decimal(1) }],
  ['kilogram', { canonical: 'kg', factor: new Decimal(1) }],
  ['كيلو', { canonical: 'kg', factor: new Decimal(1) }],
  ['كجم', { canonical: 'kg', factor: new Decimal(1) }],
  ['كغم', { canonical: 'kg', factor: new Decimal(1) }],

  ['pc', { canonical: 'pcs', factor: new Decimal(1) }],
  ['pcs', { canonical: 'pcs', factor: new Decimal(1) }],
  ['piece', { canonical: 'pcs', factor: new Decimal(1) }],
  ['حبه', { canonical: 'pcs', factor: new Decimal(1) }],
  ['حبة', { canonical: 'pcs', factor: new Decimal(1) }],
  ['قطعه', { canonical: 'pcs', factor: new Decimal(1) }],
  ['قطعة', { canonical: 'pcs', factor: new Decimal(1) }],
  ['عدد', { canonical: 'pcs', factor: new Decimal(1) }],
]);

function normalizeUnitToken(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.+/g, '')
    .replace(/\s+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');
}

function toLatinDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
}

function parseSizeDecimal(raw: unknown): Decimal | null {
  const text = toLatinDigits(String(raw ?? ''))
    .trim()
    .replace(/,/g, '')
    .replace(/[^\d.+-]/g, '');
  if (!text) return null;
  try {
    const parsed = new Decimal(text);
    if (!parsed.isFinite() || parsed.lte(0)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveUnitAlias(unit: unknown): OcrUnitAlias | null {
  const key = normalizeUnitToken(unit);
  if (!key) return null;
  return UNIT_ALIASES.get(key) || null;
}

function normalizeComparableSize(value: unknown, unit: unknown): { value: Decimal; unit: OcrCanonicalSizeUnit } | null {
  const parsedValue = parseSizeDecimal(value);
  const unitAlias = resolveUnitAlias(unit);
  if (!parsedValue || !unitAlias) return null;
  return {
    value: parsedValue.mul(unitAlias.factor),
    unit: unitAlias.canonical,
  };
}

function isNearRatio(actualRatio: Decimal, targetRatio: Decimal, toleranceRatio: Decimal): boolean {
  const diff = actualRatio.sub(targetRatio).abs();
  return diff.lte(targetRatio.mul(toleranceRatio));
}

function buildResult(
  decision: OcrSizeGateDecision,
  flags: OcrSizeGateFlag[],
  query: { value: Decimal; unit: OcrCanonicalSizeUnit } | null,
  candidate: { value: Decimal; unit: OcrCanonicalSizeUnit } | null,
): OcrSizeGateResult {
  const uniqFlags = Array.from(new Set(flags));
  return {
    decision,
    flags: uniqFlags,
    query: query ? { value: query.value.toNumber(), unit: query.unit } : null,
    candidate: candidate ? { value: candidate.value.toNumber(), unit: candidate.unit } : null,
  };
}

export function normalizeSizeUnit(unit: unknown): OcrCanonicalSizeUnit | null {
  return resolveUnitAlias(unit)?.canonical || null;
}

export function normalizeSizeValue(value: unknown, unit: unknown): number | null {
  const normalized = normalizeComparableSize(value, unit);
  if (!normalized) return null;
  return normalized.value.toNumber();
}

export function areEquivalentSizes(
  a: { value: unknown; unit: unknown },
  b: { value: unknown; unit: unknown },
): boolean {
  const left = normalizeComparableSize(a?.value, a?.unit);
  const right = normalizeComparableSize(b?.value, b?.unit);
  if (!left || !right) return false;
  if (left.unit !== right.unit) return false;

  const base = Decimal.max(left.value.abs(), right.value.abs(), new Decimal(1));
  const epsilon = base.mul(0.001); // 0.1%
  return left.value.sub(right.value).abs().lte(epsilon);
}

export function evaluateSizeGate(
  querySize: unknown,
  queryUnit: unknown,
  candidateSize: unknown,
  candidateUnit: unknown,
  options: OcrSizeGateOptions = {},
): OcrSizeGateResult {
  const toleranceRatio = new Decimal(options.toleranceRatio ?? 0.02);
  const decimalErrorRatio = new Decimal(options.decimalErrorRatio ?? 10);
  const candidateHasSizes = options.candidateHasSizes === true;

  const query = normalizeComparableSize(querySize, queryUnit);
  const candidate = normalizeComparableSize(candidateSize, candidateUnit);
  const hasQuerySize = !!query;
  const hasCandidateSize = !!candidate;

  if (hasQuerySize && hasCandidateSize) {
    if (query.unit !== candidate.unit) {
      return buildResult(
        'needs_review',
        ['incompatible_size_units', 'size_gate_blocked_auto_match'],
        query,
        candidate,
      );
    }

    if (areEquivalentSizes(
      { value: query.value, unit: query.unit },
      { value: candidate.value, unit: candidate.unit },
    )) {
      return buildResult('allow', [], query, candidate);
    }

    const maxValue = Decimal.max(query.value.abs(), candidate.value.abs());
    const minValue = Decimal.min(query.value.abs(), candidate.value.abs());
    if (minValue.gt(0)) {
      const ratio = maxValue.div(minValue);
      if (isNearRatio(ratio, decimalErrorRatio, toleranceRatio)) {
        return buildResult(
          'needs_review',
          ['possible_decimal_size_error', 'size_gate_blocked_auto_match'],
          query,
          candidate,
        );
      }
    }

    return buildResult(
      'block_auto_match',
      ['size_mismatch', 'size_gate_blocked_auto_match'],
      query,
      candidate,
    );
  }

  if (hasQuerySize && !hasCandidateSize) {
    if (candidateHasSizes) {
      return buildResult(
        'needs_review',
        ['missing_size_for_multi_size_item', 'size_gate_blocked_auto_match'],
        query,
        null,
      );
    }
    return buildResult('allow', ['size_missing_on_candidate'], query, null);
  }

  if (!hasQuerySize && (hasCandidateSize || candidateHasSizes)) {
    return buildResult(
      'needs_review',
      ['missing_size_for_multi_size_item', 'size_gate_blocked_auto_match'],
      null,
      candidate,
    );
  }

  return buildResult('allow', [], null, null);
}
