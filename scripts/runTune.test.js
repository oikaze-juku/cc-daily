import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectArticles, computeTune, parseArgs } from './runTune.js';

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

// --- --profile オプション（夫婦別プロファイル学習ループ・案B） ---

test('parseArgs: --profile 無指定なら既定 profile.json（後方互換）', () => {
  const args = parseArgs(['fav-urls.json', '14']);
  assert.equal(args.favPath, 'fav-urls.json');
  assert.equal(args.windowDays, 14);
  assert.equal(args.profilePath, 'profile.json');
});

test('parseArgs: --profile <path> を指定すると profilePath が変わる', () => {
  const args = parseArgs(['fav-urls.wife.json', '14', '--profile', 'profile.wife.json']);
  assert.equal(args.favPath, 'fav-urls.wife.json');
  assert.equal(args.windowDays, 14);
  assert.equal(args.profilePath, 'profile.wife.json');
});

test('parseArgs: windowDays 省略時は14既定（既存の後方互換を維持）', () => {
  const args = parseArgs(['fav-urls.json']);
  assert.equal(args.windowDays, 14);
  assert.equal(args.profilePath, 'profile.json');
});

test('computeTune: profile.wife.json 相当（妻タグ）を渡すと妻タグで集計される', () => {
  const wifeIssues = [
    {
      headline_top: { url: 'w1', tags: ['デザイン', 'SNS運用'] },
      categories: [{ items: [{ url: 'w2', tags: ['デザイン'] }] }],
    },
  ];
  const wifeProfile = { interest_tags: ['デザイン', 'SNS運用', 'Canva'] };
  const r = computeTune(wifeIssues, ['w1', 'w2'], wifeProfile);
  assert.equal(r.favoriteRate, 1);
  assert.equal(r.currentTags[0], 'デザイン');
  // 夫のタグ（アプリ開発など）は妻profileに無いので影響しない
  assert.ok(!r.currentTags.includes('アプリ開発'));
});
