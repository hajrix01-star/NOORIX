export type ChatIntentSource = 'gemini' | 'keyword';

export type ChatProcessQueryMeta = {
  intentSource: ChatIntentSource;
  intent?: string;
  intentConfidence?: number;
  geminiSuggestedIntent?: string;
  geminiIntentRejected?: boolean;
  geminiIntent?: string;
};

export type ChatChartMonthCompare = {
  kind: 'monthCompare';
  bars: Array<{ key: string; labelAr: string; labelEn: string; value: number }>;
};

export type ChatChartFinanceRatios = {
  kind: 'financeRatios';
  segments: Array<{ key: 'purchases' | 'expenses'; pct: number }>;
};

export type ChatResponseExtras = {
  chart?: ChatChartMonthCompare | ChatChartFinanceRatios;
};

export type ChatQueryRequest = {
  query: string;
};

export type ChatQueryResponse = {
  answerAr: string;
  answerEn: string;
  meta?: ChatProcessQueryMeta;
  extras?: ChatResponseExtras;
};
