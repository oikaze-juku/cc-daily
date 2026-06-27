// 過去号の全 URL を stdout に出力する（重複排除キー生成用）。
// 手順2で「node scripts/listUsedUrls.js」として実行する。
// ・全 JSON を読み込まずに既出 URL だけを 2KB 以下で取り出す（トークン節約）
// ・7日鮮度ルールにより 30 日より古い記事は再登場しないため、
//   直近 30 日分だけを対象にして issue 数が増えても出力が膨らまない設計にしてある。
import { readdirSync, readFileSync } from 'node:fs';

/** 号ファイル名一覧から直近 N 日分だけ返す純粋関数（YYYY-MM-DD.json 形式前提）。 */
export function recentFiles(filenames, days, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return filenames
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .filter((f) => f.slice(0, 10) >= cutoffStr);
}

/** 複数の号オブジェクトから URL を重複なく集める純粋関数。 */
export function collectUrls(issues) {
  const urls = new Set();
  const add = (item) => { if (item?.url) urls.add(item.url); };
  for (const issue of issues) {
    add(issue.headline_top);
    (issue.categories ?? []).forEach((cat) => (cat.items ?? []).forEach(add));
  }
  return [...urls];
}

// CLI として実行された場合だけ issues/ を読んで stdout に出力する。
if (process.argv[1].endsWith('listUsedUrls.js')) {
  const files = recentFiles(readdirSync('issues'), 30);
  const issues = files.map((f) => JSON.parse(readFileSync(`issues/${f}`, 'utf8')));
  process.stdout.write(collectUrls(issues).join('\n') + '\n');
}
