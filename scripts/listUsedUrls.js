// 過去号の全 URL を stdout に出力する（重複排除キー生成用）。
// 手順2で「node scripts/listUsedUrls.js」として実行し、
// 全 JSON を読み込まずに既出 URL だけを 2KB 以下で取り出す（トークン節約）。
import { readdirSync, readFileSync } from 'node:fs';

// 複数の号オブジェクトから URL を重複なく集める純粋関数。
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
  const issues = readdirSync('issues')
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(`issues/${f}`, 'utf8')));
  process.stdout.write(collectUrls(issues).join('\n') + '\n');
}
