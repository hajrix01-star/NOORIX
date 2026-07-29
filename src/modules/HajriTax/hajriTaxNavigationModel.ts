export function removeHajriTaxEditSearchParam(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('edit');
  return next;
}
