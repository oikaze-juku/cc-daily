// 共有プール（Stage A の探索結果）から、profile の interest_tags との重なりで
// 記事をスコアリングし、人（夫/妻）ごとの号 JSON を決定的に組み立てる純粋関数。
//
// LLM は呼ばない。同じ pool・profile なら常に同じ号になる（決定的）。
// ROUTINE.md の号構造規約を満たす：
//   - headline_top は上段（howto / insight / insider）から選ぶ。official は不可。
//   - official は最大1件・categories の最後（最下段）に固定。
//   - 4ジャンル（howto / insight / insider / official）＋任意で video。
//
// 入力 pool: { date, items: [{ ...記事, genre: 'howto'|'insight'|'insider'|'official'|'video' }] }
// 入力 profile: { interest_tags: string[] }
//
// 使い方（ROUTINE.md Stage B が呼ぶ。CLI部・テスト import 時は動かない）：
//   node scripts/curateForProfile.js <pool.json> <profile.json> > issues/<TODAY>.json
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GENRE_LABELS = {
  howto: '🛠 実践・活用事例',
  insight: '🤔 使いこなし考察',
  insider: '🎙 中の人ウォッチ',
  official: '📰 今週の重要ニュース',
  video: '🎬 今日の1本',
};

// 上段（headline_top の候補になれるジャンル）。official・video は不可。
const TOP_GENRES = ['howto', 'insight', 'insider'];
// 号に必ず出す並び順（official は最後＝最下段固定）。
const GENRE_ORDER = ['howto', 'insight', 'insider', 'official', 'video'];

// 記事1本のスコア：tag が interest_tags の上位にあるほど高い。
// interest_tags 未収載の tag・空 tags はスコア寄与ゼロ（末尾に回る）。
function scoreArticle(article, interestTags) {
  const tags = article.tags || [];
  let score = 0;
  for (const t of tags) {
    const idx = interestTags.indexOf(t);
    if (idx !== -1) score += interestTags.length - idx;
  }
  return score;
}

// genre を剥がして号のitem形にする（プール専用フィールドは残さない）。
function toIssueItem(article) {
  const { genre, ...rest } = article;
  return rest;
}

// 同スコアは url の昇順で安定させ、決定的な並びにする。
function sortDesc(articles, interestTags) {
  return [...articles].sort((a, b) => {
    const diff = scoreArticle(b, interestTags) - scoreArticle(a, interestTags);
    if (diff !== 0) return diff;
    return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
  });
}

export function curateForProfile(pool, profile) {
  const interestTags = profile.interest_tags || [];
  const items = pool.items || [];

  const byGenre = {};
  for (const genre of GENRE_ORDER) byGenre[genre] = [];
  for (const article of items) {
    const genre = byGenre[article.genre] ? article.genre : null;
    if (genre) byGenre[genre].push(article);
  }

  // ジャンルごとにスコア降順（決定的タイブレークはurl昇順）。
  const sortedByGenre = {};
  for (const genre of GENRE_ORDER) {
    sortedByGenre[genre] = sortDesc(byGenre[genre], interestTags);
  }

  // headline_top：上段ジャンルの中から最高スコアの1本を選ぶ。
  let headlineCandidate = null;
  for (const genre of TOP_GENRES) {
    const top = sortedByGenre[genre][0];
    if (!top) continue;
    if (!headlineCandidate || scoreArticle(top, interestTags) > scoreArticle(headlineCandidate, interestTags)) {
      headlineCandidate = top;
    } else if (
      headlineCandidate &&
      scoreArticle(top, interestTags) === scoreArticle(headlineCandidate, interestTags) &&
      top.url < headlineCandidate.url
    ) {
      headlineCandidate = top;
    }
  }

  // headline に選んだ記事は、そのジャンルのカテゴリ本体からは除く（重複掲載しない）。
  const usedUrls = new Set(headlineCandidate ? [headlineCandidate.url] : []);

  const categories = [];
  for (const genre of GENRE_ORDER) {
    let list = sortedByGenre[genre].filter((a) => !usedUrls.has(a.url));
    if (genre === 'official') list = list.slice(0, 1); // official は最大1件
    if (list.length === 0) continue; // 空ジャンルはカテゴリごと省略（空カテゴリで壊れない）
    categories.push({
      key: genre,
      label: GENRE_LABELS[genre],
      items: list.map(toIssueItem),
    });
  }

  const quietDay = !headlineCandidate;

  const issue = {
    date: pool.date,
    quiet_day: quietDay,
    categories,
  };
  if (headlineCandidate) {
    issue.headline_top = toIssueItem(headlineCandidate);
  }
  return issue;
}

// ---- CLI（直接実行されたときだけ動く。テスト import 時は動かない） ----
function main() {
  const poolPath = process.argv[2];
  const profilePath = process.argv[3];
  if (!poolPath || !profilePath) {
    process.stderr.write('使い方: node scripts/curateForProfile.js <pool.json> <profile.json>\n');
    process.exit(1);
  }
  const pool = JSON.parse(readFileSync(poolPath, 'utf8'));
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const issue = curateForProfile(pool, profile);
  process.stdout.write(JSON.stringify(issue, null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
