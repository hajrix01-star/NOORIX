export function compactIdentifier(value: unknown, options?: { head?: number; tail?: number; maxLength?: number }): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const head = options?.head ?? 10;
  const tail = options?.tail ?? 4;
  const maxLength = options?.maxLength ?? 18;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

export function compactBusinessIdentifier(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const dateSequenceMatch = text.match(/^([A-Za-z]+)-\d{8}-(\d+)$/);
  if (dateSequenceMatch) return `${dateSequenceMatch[1]}-${dateSequenceMatch[2]}`;
  return compactIdentifier(text, { head: 7, tail: 3, maxLength: 12 });
}

export function compactIdentifierList(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text
    .split(/\s*(?:\/|\||،|,|ØŒ)\s*/)
    .filter(Boolean)
    .map((part) => compactBusinessIdentifier(part))
    .join(' / ');
}

export function displayNameFromEmail(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const at = text.indexOf('@');
  return at > 0 ? text.slice(0, at) : text;
}
