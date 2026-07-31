export function percentage(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}
