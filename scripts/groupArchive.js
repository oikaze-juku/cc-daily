// アーカイブ（読んだ記事）を「その月の第N週」でグルーピングする純粋関数群。
// 例: 2026-06-22 → 「2026年6月 第4週」。1〜7日=第1週, 8〜14日=第2週 …（7日単位）。

export function weekOfMonth(day) {
  return Math.ceil(day / 7);
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

export function weekLabel(dateStr) {
  const { y, m, d } = parseDate(dateStr);
  return `${y}年${m}月 第${weekOfMonth(d)}週`;
}

// ソート用の数値キー（大きいほど新しい週）。
export function weekKey(dateStr) {
  const { y, m, d } = parseDate(dateStr);
  return y * 10000 + m * 100 + weekOfMonth(d);
}

// entries: [{ item, date }] を週ごとにまとめる。
// 戻り値: [{ key, label, entries:[{item,date}] }]（新しい週が先・週内も新しい号が先）
export function groupByWeek(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = weekKey(e.date);
    if (!map.has(key)) map.set(key, { key, label: weekLabel(e.date), entries: [] });
    map.get(key).entries.push(e);
  }
  const groups = [...map.values()];
  groups.sort((a, b) => b.key - a.key); // 週: 新しい順
  for (const g of groups) {
    g.entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 号: 新しい順
  }
  return groups;
}
