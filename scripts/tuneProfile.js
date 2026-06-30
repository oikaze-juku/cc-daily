// お気に入り信号から「★率」を測り、interest_tags を並べ替える純粋関数。
//
// これが CC Daily を「毎朝同じ routine」から「日々良くなる loop」に変える中核。
// - 測れるゴール：favoriteRate（提示記事のうち★が付いた割合）
// - 記憶のフィードバック：★が集まったタグを上位へ繰り上げた newTags
//
// 少量データ（二人・週数件）なのでノイズに弱い。だから安全側に倒す：
//   * タグの増減はしない（並べ替えのみ）。増減は addCandidates/removeCandidates で
//     「提案」に留め、人間が判断する（ハイブリッド方式）。
//   * ★が1件だけのタグは繰り上げない（偶然を拾わない）。
//
// 入力 articles: [{ url, tags: string[], favorited: boolean }]（直近ウィンドウの提示記事）
// 入力 profile : { interest_tags: string[] }
const PROMOTE_THRESHOLD = 2; // 繰り上げ・追加候補に必要な最低★数

export function tuneProfile(articles, profile) {
  const current = profile.interest_tags || [];

  // ★率＝お気に入り数 ÷ 提示数
  const presented = articles.length;
  const favorited = articles.filter((a) => a.favorited);
  const favoriteRate = presented ? favorited.length / presented : 0;

  // ★が付いた記事のタグ頻度を集計
  const counts = {};
  favorited.forEach((a) => (a.tags || []).forEach((t) => {
    counts[t] = (counts[t] || 0) + 1;
  }));

  // 並べ替え：閾値以上★が付いた既存タグを多い順に前へ、残りは元順を維持（安定）
  const promoted = current
    .filter((t) => (counts[t] || 0) >= PROMOTE_THRESHOLD)
    .sort((a, b) => counts[b] - counts[a]);
  const rest = current.filter((t) => (counts[t] || 0) < PROMOTE_THRESHOLD);
  const newTags = [...promoted, ...rest];

  // 提案（自動適用しない）：未登録タグに★が集まった＝追加候補／一度も★が無い既存タグ＝削除候補
  const known = new Set(current);
  const addCandidates = Object.keys(counts)
    .filter((t) => !known.has(t) && counts[t] >= PROMOTE_THRESHOLD)
    .sort((a, b) => counts[b] - counts[a]);
  const removeCandidates = current.filter((t) => !counts[t]);

  return { favoriteRate, counts, newTags, addCandidates, removeCandidates };
}
