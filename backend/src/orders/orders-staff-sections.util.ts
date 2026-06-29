export function resolveProductSection(product: { sections?: unknown } | null | undefined): string {
  const sections = product?.sections as string[] | null;
  if (Array.isArray(sections) && sections.length > 0) return sections[0];
  return 'عام';
}
