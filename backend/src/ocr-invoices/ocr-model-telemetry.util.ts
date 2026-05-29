export type OcrModelAttemptStage = 'none' | 'direct' | 'local_repair' | 'ai_repair';
export type OcrModelAttemptOutcome =
  | 'success'
  | 'unavailable'
  | 'blocked'
  | 'empty'
  | 'parse_failed'
  | 'schema_failed'
  | 'http_error'
  | 'runtime_error';

export type OcrModelAttemptTelemetry = {
  model: string;
  version: string;
  structuredOutput: boolean;
  startedAt: string;
  latencyMs: number;
  outcome: OcrModelAttemptOutcome;
  parseStage: OcrModelAttemptStage;
  stageDurationsMs?: {
    requestMs?: number;
    parseAndValidateMs?: number;
    directParseMs?: number;
    localRepairMs?: number;
    aiRepairMs?: number;
    zodValidateMs?: number;
    signalChecksMs?: number;
    mathValidationMs?: number;
    enrichMs?: number;
  };
  httpStatus?: number;
  finishReason?: string;
  blockReason?: string;
  error?: string;
};

export function trimErrorText(value: unknown, maxLen = 260): string | undefined {
  const text = typeof value === 'string'
    ? value
    : value instanceof Error
      ? value.message
      : value != null
        ? String(value)
        : '';
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function buildModelTelemetryFlags(
  attempts: OcrModelAttemptTelemetry[],
  primaryModel: string | undefined,
  usedModel: string | undefined,
): string[] {
  const flags = new Set<string>();
  if (attempts.length > 1) flags.add('model_multi_attempt');
  if (primaryModel && usedModel && primaryModel !== usedModel) flags.add('model_fallback_used');
  if (attempts.some((a) => a.outcome === 'unavailable')) flags.add('model_unavailable_retry');
  if (attempts.some((a) => a.outcome === 'blocked')) flags.add('model_blocked_retry');
  if (attempts.some((a) => a.parseStage === 'local_repair' || a.parseStage === 'ai_repair')) {
    flags.add('model_repair_path_used');
  }
  return Array.from(flags);
}

export function attachModelTelemetry(
  payload: Record<string, unknown>,
  args: {
    attempts: OcrModelAttemptTelemetry[];
    usedModel?: string;
    usedModelVersion?: string;
    extractionStartedAt: number;
    primaryModel?: string;
  },
): Record<string, unknown> {
  const modelQualityFlags = buildModelTelemetryFlags(args.attempts, args.primaryModel, args.usedModel);
  const existingQualityFlags = Array.isArray(payload.qualityFlags)
    ? payload.qualityFlags.filter((x): x is string => typeof x === 'string')
    : [];
  const qualityFlags = Array.from(new Set([...existingQualityFlags, ...modelQualityFlags]));
  const qualityStatus = typeof payload.qualityStatus === 'string'
    ? payload.qualityStatus
    : qualityFlags.includes('validated') && qualityFlags.length === 1
      ? 'validated'
      : 'needs_review';

  return {
    ...payload,
    usedModel: args.usedModel || payload.usedModel || null,
    usedModelVersion: args.usedModelVersion || payload.usedModelVersion || null,
    modelAttempts: args.attempts,
    extractionLatencyMs: Date.now() - args.extractionStartedAt,
    qualityFlags,
    qualityStatus,
  };
}

export function attachPipelineStageTelemetry(
  payload: Record<string, unknown>,
  stageTotals: { modelRequestMs: number; jsonValidationMs: number; enrichmentMs: number },
): Record<string, unknown> {
  const failureStage =
    payload.pipelineFailureStage === 'model_request' || payload.pipelineFailureStage === 'json_validation'
      ? payload.pipelineFailureStage
      : null;
  const failureReason =
    typeof payload.pipelineFailureReason === 'string'
      ? payload.pipelineFailureReason
      : typeof payload.errorDetail === 'string'
        ? payload.errorDetail
        : undefined;
  const parseError = !!payload.parseError || failureStage === 'json_validation';
  const enrichError = typeof payload.enrichError === 'string' && payload.enrichError.trim().length > 0;
  return {
    ...payload,
    extractionStageTelemetry: {
      stages: {
        modelRequest: {
          durationMs: stageTotals.modelRequestMs,
          status: failureStage === 'model_request' ? 'failed' : 'success',
        },
        jsonValidation: {
          durationMs: stageTotals.jsonValidationMs,
          status: failureStage === 'json_validation' ? 'failed' : 'success',
        },
        enrichment: {
          durationMs: stageTotals.enrichmentMs,
          status: parseError ? 'skipped' : enrichError ? 'warning' : 'success',
        },
        readyForReview: {
          durationMs: 0,
          status: parseError ? 'skipped' : 'success',
        },
      },
      failedStage: failureStage || undefined,
      failureReason: trimErrorText(failureReason, 400),
    },
  };
}
