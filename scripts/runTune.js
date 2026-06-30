// 夜チューニングの集計ドライバ。
//
// 直近の号（提示記事）と Firestore から取った★お気に入りURLを突き合わせ、
// scripts/tuneProfile.js（テスト済みの純粋関数）に渡して
// 「★率・タグ並べ替え案・増減候補」を計算する。
//
// 中核は computeTune（純粋関数・テスト対象）。ファイル読み込みは下の CLI 部だけ。
//
// 使い方（クラウドRoutineがTUNE.mdの手順で呼ぶ）：
//   node scripts/runTune.js <favorited-urls.json> [windowDays=14]
//   - <favorited-urls.json>: ["https://...", ...] か {"favoritedUrls":[...]} 形式
//   - 出力: 集計結果JSONを stdout に印字
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tuneProfile } from './tuneProfile.js';

// 号の配列から全記事（headline + 各カテゴリ）を1本の配列に
export function collectArticles(issues) {
  const items = [];
  for (const issue of issues) {
    if (issue && issue.headline_top) items.push(issue.headline_top);
    (issue && issue.categories || []).forEach((c) => (c.items || []).forEach((i) => items.push(i)));
  }
  return items;
}

// 純粋関数：号配列・★URL集合・profile から集計結果を返す（テスト対象）
export function computeTune(issues, favoritedUrls, profile) {
  const favSet = new Set(favoritedUrls || []);
  const articles = collectArticles(issues).map((a) => ({
    url: a.url,
    tags: a.tags || [],
    favorited: favSet.has(a.url),
  }));
  const result = tuneProfile(articles, profile);
  const current = profile.interest_tags || [];
  const reorderChanged = JSON.stringify(current) !== JSON.stringify(result.newTags);
  return {
    presented: articles.length,
    favoritedCount: articles.filter((a) => a.favorited).length,
    currentTags: current,
    reorderChanged,
    ...result,
  };
}

// ---- CLI（直接実行されたときだけ動く。テスト import 時は動かない） ----
function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const favPath = process.argv[2];
  const windowDays = Number(process.argv[3]) || 14;

  // ★URL（無ければ空＝採点だけ進める）
  let favoritedUrls = [];
  if (favPath && existsSync(favPath)) {
    const raw = readJSON(favPath);
    favoritedUrls = Array.isArray(raw) ? raw : (raw.favoritedUrls || []);
  }

  // 直近 windowDays 件の号を manifest（新しい順）から読む
  const manifest = readJSON('issues/manifest.json');
  const issues = [];
  for (const m of manifest.slice(0, windowDays)) {
    if (existsSync(m.path)) {
      try { issues.push(readJSON(m.path)); } catch (_) { /* 壊れた号は飛ばす */ }
    }
  }

  const profile = readJSON('profile.json');
  const out = computeTune(issues, favoritedUrls, profile);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
