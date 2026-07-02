// 夜チューニングの集計ドライバ。
//
// 直近の号（提示記事）と Firestore から取った★お気に入りURLを突き合わせ、
// scripts/tuneProfile.js（テスト済みの純粋関数）に渡して
// 「★率・タグ並べ替え案・増減候補」を計算する。
//
// 中核は computeTune（純粋関数・テスト対象）。ファイル読み込みは下の CLI 部だけ。
//
// 使い方（クラウドRoutineがTUNE.mdの手順で呼ぶ）：
//   node scripts/runTune.js <favorited-urls.json> [windowDays=14] [--profile <path>]
//   - <favorited-urls.json>: ["https://...", ...] か {"favoritedUrls":[...]} 形式
//   - --profile <path>: 読み込む好みプロファイル（既定 profile.json＝後方互換）。
//     夫婦別プロファイル学習ループでは夫=profile.json／妻=profile.wife.json を渡す。
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

// CLI引数パース（純粋関数・テスト対象）：
//   位置引数1 = favPath、位置引数2 = windowDays（省略時14）、--profile <path>（省略時 profile.json）
export function parseArgs(argv) {
  const positional = [];
  let profilePath = 'profile.json';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile') {
      profilePath = argv[i + 1];
      i++;
    } else {
      positional.push(argv[i]);
    }
  }
  return {
    favPath: positional[0],
    windowDays: Number(positional[1]) || 14,
    profilePath,
  };
}

// ---- CLI（直接実行されたときだけ動く。テスト import 時は動かない） ----
function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const { favPath, windowDays, profilePath } = parseArgs(process.argv.slice(2));

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

  const profile = readJSON(profilePath);
  const out = computeTune(issues, favoritedUrls, profile);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
