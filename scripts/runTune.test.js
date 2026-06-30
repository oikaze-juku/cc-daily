import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectArticles, computeTune } from './runTune.js';

const issues = [
  {
    headline_top: { url: 'u1', tags: ['アプリ開発', '自動化'] },
    categories: [
      { items: [{ url: 'u2', tags: ['自動化'] }, { url: 'u3', tags: ['請求・全銀'] }] },
    ],
  },
  {
    categories: [{ items: [{ url: 'u4', tags: ['自動化'] }] }],
  },
];

const profile = { interest_tags: ['塾管理', 'アプリ開発', '自動化', '請求・全銀'] };

test('collectArticles: headline と各カテゴリの記事を全部集める', () => {
  assert.equal(collectArticles(issues).length, 4);
});

test('collectArticles: headline_top が無い号も壊れない', () => {
  assert.equal(collectArticles([{ categories: [{ items: [{ url: 'x' }] }] }]).length, 1);
});

test('★率＝お気に入り数 ÷ 提示数', () => {
  const r = computeTune(issues, ['u1', 'u2'], profile);
  assert.equal(r.presented, 4);
  assert.equal(r.favoritedCount, 2);
  assert.equal(r.favoriteRate, 0.5);
});

test('★2件以上のタグが上位へ並び替わると reorderChanged=true', () => {
  // u1(自動化,アプリ開発) u2(自動化) u4(自動化) を★→ 自動化が3件で先頭へ
  const r = computeTune(issues, ['u1', 'u2', 'u4'], profile);
  assert.equal(r.reorderChanged, true);
  assert.equal(r.newTags[0], '自動化');
});

test('★が無ければ並びは元のまま・reorderChanged=false', () => {
  const r = computeTune(issues, [], profile);
  assert.equal(r.reorderChanged, false);
  assert.deepEqual(r.newTags, profile.interest_tags);
});

test('未登録タグに★2件以上で addCandidates に出る', () => {
  const issues2 = [
    { categories: [{ items: [
      { url: 'a', tags: ['新タグ'] }, { url: 'b', tags: ['新タグ'] },
    ] }] },
  ];
  const r = computeTune(issues2, ['a', 'b'], profile);
  assert.ok(r.addCandidates.includes('新タグ'));
});

test('一度も★が付かない既存タグは removeCandidates に出る', () => {
  const r = computeTune(issues, ['u1'], profile);
  // 塾管理 は提示されていない＝0★ → 削除候補
  assert.ok(r.removeCandidates.includes('塾管理'));
});
