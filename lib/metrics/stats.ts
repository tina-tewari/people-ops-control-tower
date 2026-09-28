export function median(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
