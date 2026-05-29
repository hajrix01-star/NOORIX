import {
  areEquivalentSizes,
  evaluateSizeGate,
  normalizeSizeUnit,
  normalizeSizeValue,
} from './ocr-size-gate.util';

describe('ocr-size-gate util', () => {
  it('normalizes 1000ml to 1L as equivalent', () => {
    expect(normalizeSizeUnit('ml')).toBe('L');
    expect(normalizeSizeValue('1000', 'ml')).toBeCloseTo(1, 8);
    expect(areEquivalentSizes({ value: '1000', unit: 'ml' }, { value: '1', unit: 'L' })).toBe(true);
  });

  it('treats 1800ml and 1.8L as equivalent', () => {
    expect(areEquivalentSizes({ value: '1800', unit: 'ml' }, { value: '1.8', unit: 'L' })).toBe(true);
  });

  it('treats 500g and 0.5kg as equivalent', () => {
    expect(areEquivalentSizes({ value: '500', unit: 'g' }, { value: '0.5', unit: 'kg' })).toBe(true);
  });

  it('blocks auto match for PEPSI 330ML vs PEPSI 1L', () => {
    const gate = evaluateSizeGate('330', 'ml', '1', 'L', { candidateHasSizes: true });
    expect(gate.decision).toBe('block_auto_match');
    expect(gate.flags).toContain('size_mismatch');
    expect(gate.flags).toContain('size_gate_blocked_auto_match');
  });

  it('blocks auto match for زيت 1.8L vs زيت 3L', () => {
    const gate = evaluateSizeGate('1.8', 'L', '3', 'L', { candidateHasSizes: true });
    expect(gate.decision).toBe('block_auto_match');
    expect(gate.flags).toContain('size_mismatch');
  });

  it('blocks auto match for سكر 10kg vs سكر 50kg', () => {
    const gate = evaluateSizeGate('10', 'kg', '50', 'kg', { candidateHasSizes: true });
    expect(gate.decision).toBe('block_auto_match');
    expect(gate.flags).toContain('size_mismatch');
  });

  it('returns needs_review when query has no size and candidate has sizes', () => {
    const gate = evaluateSizeGate(null, null, null, null, { candidateHasSizes: true });
    expect(gate.decision).toBe('needs_review');
    expect(gate.flags).toContain('missing_size_for_multi_size_item');
  });

  it('returns needs_review when query has size but candidate size is missing while candidate hasSizes=true', () => {
    const gate = evaluateSizeGate('500', 'g', null, null, { candidateHasSizes: true });
    expect(gate.decision).toBe('needs_review');
    expect(gate.flags).toContain('missing_size_for_multi_size_item');
  });

  it('returns incompatible_size_units when units are not comparable', () => {
    const gate = evaluateSizeGate('1', 'L', '1', 'kg', { candidateHasSizes: true });
    expect(gate.decision).toBe('needs_review');
    expect(gate.flags).toContain('incompatible_size_units');
  });

  it('returns possible_decimal_size_error for 18L vs 1.8L', () => {
    const gate = evaluateSizeGate('18', 'L', '1.8', 'L', { candidateHasSizes: true });
    expect(gate.decision).toBe('needs_review');
    expect(gate.flags).toContain('possible_decimal_size_error');
    expect(gate.flags).toContain('size_gate_blocked_auto_match');
  });
});
