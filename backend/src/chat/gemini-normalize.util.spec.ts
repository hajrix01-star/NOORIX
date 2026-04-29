import { normalizeGeminiIntent } from './gemini-normalize.util';

describe('normalizeGeminiIntent', () => {
  it("returns 'dashboard_insights' for dashboard_insights", () => {
    expect(normalizeGeminiIntent('dashboard_insights')).toBe('dashboard_insights');
    expect(normalizeGeminiIntent('DASHBOARD_INSIGHTS')).toBe('dashboard_insights');
  });

  it('maps unknown strings to unknown', () => {
    expect(normalizeGeminiIntent('not_a_real_intent')).toBe('unknown');
  });
});
