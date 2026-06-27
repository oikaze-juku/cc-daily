// sources.json → sources-lean.json を生成する。
// sources.json を更新したら「node scripts/buildLeanSources.js」で再生成する。
//
// 削減方針:
// - name フィールド削除（AI不要・人間向け説明）
// - _探索ルール 削除（ROUTINE.md 手順3に統合済み）
// - atom/page 型の primary は watch 不要（URL が自明）
// - それ以外の watch は MAX_WATCH_CHARS 以内に切る
// - x-watch 型は handle を保持

import { readFileSync, writeFileSync } from 'node:fs';

const MAX_WATCH_CHARS = 30;

const src = JSON.parse(readFileSync('sources.json', 'utf8'));

function trimWatch(entry) {
  const { name: _name, ...rest } = entry;
  if (!rest.watch) return rest;

  // atom/page 型の primary カテゴリは watch を省略（公式ソースは URL が自明）
  if ((rest.type === 'atom' || rest.type === 'page') && rest.category === 'official') {
    const { watch: _w, ...noWatch } = rest;
    return noWatch;
  }

  // x-watch 型は handle があれば watch を短縮（検索クエリのヒントだけ残す）
  if (rest.type === 'x-watch') {
    const trimmed = rest.watch.length > MAX_WATCH_CHARS
      ? rest.watch.slice(0, MAX_WATCH_CHARS).replace(/。[^。]*$/, '。')
      : rest.watch;
    return { ...rest, watch: trimmed };
  }

  // 一般: MAX_WATCH_CHARS 以内に切る（文末の中途半端な切れを句点で調整）
  if (rest.watch.length > MAX_WATCH_CHARS) {
    const trimmed = rest.watch.slice(0, MAX_WATCH_CHARS).replace(/[^。]*$/, '');
    return { ...rest, watch: trimmed || rest.watch.slice(0, MAX_WATCH_CHARS) };
  }
  return rest;
}

// _探索ルール を除いた全カテゴリを処理
const lean = {};
for (const [key, val] of Object.entries(src)) {
  if (key.startsWith('_')) continue; // _探索ルール を除外
  lean[key] = Array.isArray(val) ? val.map(trimWatch) : val;
}

writeFileSync('sources-lean.json', JSON.stringify(lean, null, 2) + '\n');

// サイズ比較
const origSize = JSON.stringify(src).length;
const leanSize = JSON.stringify(lean).length;
const saved = origSize - leanSize;
console.log(`sources.json:      ${origSize.toLocaleString()} chars`);
console.log(`sources-lean.json: ${leanSize.toLocaleString()} chars`);
console.log(`削減: ${saved.toLocaleString()} chars (${Math.round(saved / origSize * 100)}%)`);
