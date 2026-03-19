const META_PREFIX = '[HR_META]';

export function parseEmployeeNotesMeta(rawNotes) {
  const raw = String(rawNotes || '');
  const idx = raw.lastIndexOf(META_PREFIX);
  if (idx < 0) {
    return {
      notesText: raw.trim(),
      meta: {},
    };
  }

  const notesText = raw.slice(0, idx).trim();
  const jsonPart = raw.slice(idx + META_PREFIX.length).trim();
  try {
    const meta = JSON.parse(jsonPart);
    return {
      notesText,
      meta: meta && typeof meta === 'object' ? meta : {},
    };
  } catch {
    return {
      notesText: raw.trim(),
      meta: {},
    };
  }
}

export function composeEmployeeNotes(notesText, meta = {}) {
  const text = String(notesText || '').trim();
  const safeMeta = Object.fromEntries(
    Object.entries(meta || {}).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ''),
  );
  const hasMeta = Object.keys(safeMeta).length > 0;
  if (!hasMeta) return text;
  const metaPart = `${META_PREFIX}${JSON.stringify(safeMeta)}`;
  if (!text) return metaPart;
  return `${text}\n\n${metaPart}`;
}
