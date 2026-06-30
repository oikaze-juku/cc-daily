import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tuneProfile } from './tuneProfile.js';

const profile = { interest_tags: ['塾管理', 'アプリ開発', '自動化', '集客'] };

test('提示が無ければ★率0・並びは元のまま・候補なし', () => {
  const r = tuneProfile([], profile);
  assert.equal(r.favoriteRate, 0);
  assert.deepEqual(r.newTags, profile.interest_tags);
  assert.deepEqual(r.addCandidates, []);
  assert.deepEqual(r.removeCandidates, ['塾管理', 'アプリ開発', '自動化', '集客']);
});

test('★率＝お気に入り数 ÷ 提示数', () => {
  const articles = [
    { url: 'a', tags: ['アプリ開発'], favorited: true },
    { url: 'b', tags: ['集客'], favorited: false },
    { url: 'c', tags: ['自動化'], favorited: true },
    { url: 'd', tags: [], favorited: false },
  ];
  const r = tuneProfile(articles, profile);
  assert.equal(r.favoriteRate, 0.5);
});

test('★が2件以上付いたタグは上位へ繰り上がる（多い順）', () => {
  const articles = [
    { url: 'a', tags: ['自動化'], favorited: true },
    { url: 'b', tags: ['自動化', 'アプリ開発'], favorited: true },
    { url: 'c', tags: ['アプリ開発'], favorited: true },
  ];
  const r = tuneProfile(articles, profile);
  // 自動化=2, アプリ開発=2 → 元順(アプリ開発<自動化)だが同数なので安定。両方とも繰り上げ。
  assert.deepEqual(r.newTags.slice(0, 2).sort(), ['アプリ開発', '自動化']);
  assert.ok(r.newTags.includes('塾管理'));
  assert.equal(r.newTags.length, profile.interest_tags.length);
});

test('★が1件だけのタグは繰り上げない（ノイズ抑制）', () => {
  const articles = [{ url: 'a', tags: ['集客'], favorited: true }];
  const r = tuneProfile(articles, profile);
  assert.deepEqual(r.newTags, profile.interest_tags);
});

test('未登録タグに★2件以上＝追加候補', () => {
  const articles = [
    { url: 'a', tags: ['野球'], favorited: true },
    { url: 'b', tags: ['野球'], favorited: true },
  ];
  const r = tuneProfile(articles, profile);
  assert.deepEqual(r.addCandidates, ['野球']);
});

test('★が一度も付かない既存タグ＝削除候補', () => {
  const articles = [
    { url: 'a', tags: ['アプリ開発'], favorited: true },
    { url: 'b', tags: ['アプリ開発'], favorited: true },
  ];
  const r = tuneProfile(articles, profile);
  assert.ok(r.removeCandidates.includes('集客'));
  assert.ok(!r.removeCandidates.includes('アプリ開発'));
});

test('元のタグは増減しない（並べ替えのみ・記憶の安全）', () => {
  const articles = [
    { url: 'a', tags: ['自動化'], favorited: true },
    { url: 'b', tags: ['自動化'], favorited: true },
  ];
  const r = tuneProfile(articles, profile);
  assert.deepEqual([...r.newTags].sort(), [...profile.interest_tags].sort());
});
