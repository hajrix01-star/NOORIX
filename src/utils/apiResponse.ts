export function getApiErrorMessage(result: any, fallback: any = 'Request failed') {
  if (!result || typeof result !== 'object') return fallback;
  const r = result as { error?: string; message?: string };
  return r.error || r.message || fallback;
}
