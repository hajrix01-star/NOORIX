import { describe, it, expect } from 'vitest';
import { reportingInsightThresholdsKeys } from './reportingInsightThresholdsKeys';

describe('reportingInsightThresholdsKeys', () => {
  it('company key is stable', () => {
    expect(reportingInsightThresholdsKeys.company('c1')).toEqual(reportingInsightThresholdsKeys.company('c1'));
  });

  it('root prefix', () => {
    expect(reportingInsightThresholdsKeys.root()).toEqual(['reporting-insight-thresholds']);
  });
});
