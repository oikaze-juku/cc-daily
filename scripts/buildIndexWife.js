// issuesディレクトリのファイル名一覧から、妻用の号（*.wife.json）だけを拾い、
// 新しい順のバックナンバー索引を作る純粋関数。buildIndex.js の妻版。
export function buildIndexWife(filenames) {
  return filenames
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.wife\.json$/.test(f))
    .map((f) => f.replace(/\.wife\.json$/, ''))
    .sort()
    .reverse()
    .map((date) => ({ date, path: `issues/${date}.wife.json` }));
}
