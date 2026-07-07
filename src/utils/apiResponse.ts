export function getApiErrorMessage(result: unknown, fallback = 'Request failed') {
  if (!result || typeof result !== 'object') return fallback;
  const r = result as { error?: string; message?: string };
  return r.error || r.message || fallback;
}
