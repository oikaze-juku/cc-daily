// 既出キー（過去号で出した url）を除いて新着だけ返す純粋関数。
export function dedupe(items, seenKeys) {
  const seen = new Set(seenKeys);
  return items.filter((it) => !seen.has(it.url));
}
