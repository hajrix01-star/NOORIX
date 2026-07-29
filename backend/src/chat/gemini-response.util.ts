export type GeminiGenerateContentResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export function getGeminiCandidateText(data: GeminiGenerateContentResponse): string | null {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' && text.trim() ? text : null;
}

export function getGeminiFinishReason(data: GeminiGenerateContentResponse): string | undefined {
  const reason = data.candidates?.[0]?.finishReason;
  return typeof reason === 'string' ? reason : undefined;
}
