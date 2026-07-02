import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curateForProfile } from './curateForProfile.js';

// プール記事のひな形。genre は Stage A（探索）が付ける号カテゴリの key（howto/insight/insider/official/video）。
function article(url, genre, tags) {
  return {
    title_ja: `title-${url}`,
    summary_ja: ['a', 'b', 'c'],
    article: ['本文'],
    source_date: '2026-06-30',
    url,
    trust: '🟩',
    tags,
    try_hint: 'hint',
    genre,
  };
}

const husbandProfile = { interest_tags: ['アプリ開発', '自動化', '塾管理'] };
const wifeProfile = { interest_tags: ['デザイン', 'SNS運用', 'Canva'] };

test('1. プール12本からprofileの上位tagに合う号が決定的に選抜される', () => {
  const pool = {
    date: '2026-06-30',
    items: [
      article('h1', 'howto', ['アプリ開発', '自動化']),
      article('h2', 'howto', ['自動化']),
      article('i1', 'insight', ['アプリ開発']),
      article('ins1', 'insider', ['塾管理']),
      article('o1', 'official', ['アプリ開発']),
      article('h3', 'howto', ['デザイン']),
      article('h4', 'howto', ['SNS運用']),
      article('i2', 'insight', ['Canva']),
      article('ins2', 'insider', ['デザイン']),
      article('o2', 'official', ['SNS運用']),
      article('h5', 'howto', []),
      article('h6', 'howto', ['自動化', 'アプリ開発', '塾管理']),
    ],
  };
  const issue1 = curateForProfile(pool, husbandProfile);
  const issue2 = curateForProfile(pool, husbandProfile);
  assert.deepEqual(issue1, issue2, '同じ pool・profile なら決定的に同じ号');
  assert.ok(issue1.headline_top, 'headline_top がある');
  assert.equal(issue1.date, '2026-06-30');
});

test('2. 夫profileと妻profileで異なる選抜になる（同一プールで並びが変わる）', () => {
  const pool = {
    date: '2026-06-30',
    items: [
      article('h1', 'howto', ['アプリ開発', '自動化']),
      article('h2', 'howto', ['デザイン', 'Canva']),
      article('i1', 'insight', ['自動化']),
      article('i2', 'insight', ['SNS運用']),
      article('ins1', 'insider', ['塾管理']),
      article('ins2', 'insider', ['デザイン']),
    ],
  };
  const husbandIssue = curateForProfile(pool, husbandProfile);
  const wifeIssue = curateForProfile(pool, wifeProfile);
  assert.notEqual(husbandIssue.headline_top.url, wifeIssue.headline_top.url);
});

test('3. official がプールにあっても headline_top に来ない・最下段1件に収まる', () => {
  const pool = {
    date: '2026-06-30',
    items: [
      article('o1', 'official', ['アプリ開発', '自動化', '塾管理']),
      article('o2', 'official', ['アプリ開発']),
      article('h1', 'howto', []),
    ],
  };
  const issue = curateForProfile(pool, husbandProfile);
  if (issue.headline_top) {
    assert.notEqual(issue.headline_top.url, 'o1');
  }
  const officialItems = (issue.categories || [])
    .filter((c) => c.key === 'official')
    .flatMap((c) => c.items || []);
  assert.ok(officialItems.length <= 1, 'official は最大1件');
  if (issue.categories.length > 0) {
    const lastCat = issue.categories[issue.categories.length - 1];
    if (officialItems.length > 0) {
      assert.equal(lastCat.key, 'official', 'official は最下段');
    }
  }
});

test('4. あるジャンルがプールに無ければ空カテゴリで壊れない', () => {
  // howto を2本にする：1本目は headline_top に抜かれる想定なので、
  // categories 側に howto が残ることも合わせて確認する。
  const pool = {
    date: '2026-06-30',
    items: [
      article('h1', 'howto', ['アプリ開発', '自動化']),
      article('h2', 'howto', ['自動化']),
    ],
  };
  const issue = curateForProfile(pool, husbandProfile);
  assert.equal(issue.quiet_day, false);
  assert.ok(Array.isArray(issue.categories));
  // insight/insider/official が無くても例外を投げず、howto だけの号になる
  const howtoItems = (issue.categories || [])
    .filter((c) => c.key === 'howto')
    .flatMap((c) => c.items || []);
  assert.ok(howtoItems.length >= 1);
  // insight/insider/official のカテゴリはプールに無いので出ない（空カテゴリを作らない）
  const genres = issue.categories.map((c) => c.key);
  assert.ok(!genres.includes('insight'));
  assert.ok(!genres.includes('insider'));
  assert.ok(!genres.includes('official'));
});

test('5. tagが空の記事・interest_tagsに無いtagのみの記事の扱いが決定的（末尾or除外）', () => {
  const pool = {
    date: '2026-06-30',
    items: [
      article('h1', 'howto', ['アプリ開発', '自動化']),
      article('h2', 'howto', []),
      article('h3', 'howto', ['無関係タグ']),
    ],
  };
  const issue1 = curateForProfile(pool, husbandProfile);
  const issue2 = curateForProfile(pool, husbandProfile);
  assert.deepEqual(issue1, issue2);
  // h1 はスコア最高なので headline_top に選ばれる
  assert.equal(issue1.headline_top.url, 'h1');
  const howtoUrls = (issue1.categories || [])
    .filter((c) => c.key === 'howto')
    .flatMap((c) => c.items || [])
    .map((i) => i.url);
  // 残り2本（tag無し・関係ないtagのみ）はスコア0タイ→url昇順で決定的に並ぶ
  assert.deepEqual(howtoUrls, ['h2', 'h3']);
});

test('genre 情報は号の item には残らない（プール専用フィールドを剥がす）', () => {
  const pool = {
    date: '2026-06-30',
    items: [
      article('h1', 'howto', ['アプリ開発']),
      article('h2', 'howto', ['自動化']),
    ],
  };
  const issue = curateForProfile(pool, husbandProfile);
  const item = issue.categories[0].items[0];
  assert.equal(item.genre, undefined);
});
