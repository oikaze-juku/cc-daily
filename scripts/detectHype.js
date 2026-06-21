// 煽り・インプ稼ぎ・誇大広告を語彙ベースで検出する純粋関数。
// 「再現手段（動くコード/一次ソース）が無い」判定は Routine 側の役割。ここは語彙のみ。
const PATTERNS = [
  /make\s+\$?\d/i,
  /passive income/i,
  /get rich/i,
  /guaranteed/i,
  /you won['']?t believe/i,
  /this one (weird )?trick/i,
  /nobody is talking about/i,
  /これで(月|稼|儲)/,
  /月収\s*\d/,
  /誰でも(簡単|稼)/,
  /知らないと損/,
  /神ツール/,
  /もう.*(要らない|不要)/,
];

export function detectHype(text) {
  const reasons = [];
  for (const re of PATTERNS) {
    if (re.test(text)) reasons.push(`煽り表現: ${re.source}`);
  }
  return { isHype: reasons.length > 0, reasons };
}
