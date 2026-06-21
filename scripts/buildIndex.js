// issuesディレクトリのファイル名一覧から、新しい順のバックナンバー索引を作る純粋関数。
export function buildIndex(filenames) {
  return filenames
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ''))
    .sort()
    .reverse()
    .map((date) => ({ date, path: `issues/${date}.json` }));
}
