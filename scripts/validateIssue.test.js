import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIssue } from './validateIssue.js';

const goodItem = { title_ja: 'x', summary_ja: ['a', 'b', 'c'], url: 'https://e.com', trust: '🟩', tags: [], try_hint: '', source_date: '2026-06-22', ideas: ['案1', '案2', '案3'] };

test('正しい号は valid', () => {
  const issue = { date: '2026-06-22', quiet_day: false, headline_top: goodItem, categories: [{ key: 'official', items: [goodItem] }] };
  assert.equal(validateIssue(issue).valid, true);
});

test('summary_jaが3行でないと invalid', () => {
  const bad = { ...goodItem, summary_ja: ['a', 'b'] };
  const issue = { date: '2026-06-22', quiet_day: false, headline_top: goodItem, categories: [{ items: [bad] }] };
  assert.equal(validateIssue(issue).valid, false);
});

test('通常日にheadline_topが無いと invalid', () => {
  const issue = { date: '2026-06-22', quiet_day: false, categories: [] };
  assert.ok(validateIssue(issue).errors.some((e) => e.includes('headline_top')));
});

test('静かな日は headline_top 無しでも valid', () => {
  const issue = { date: '2026-06-22', quiet_day: true, categories: [] };
  assert.equal(validateIssue(issue).valid, true);
});

test('source_date（情報の日付）が無いと invalid', () => {
  const { source_date, ...bad } = goodItem;
  const issue = { date: '2026-06-22', quiet_day: false, headline_top: goodItem, categories: [{ items: [bad] }] };
  assert.equal(validateIssue(issue).valid, false);
});

test('ideas（応用アイデア配列）が無いと invalid', () => {
  const { ideas, ...bad } = goodItem;
  const issue = { date: '2026-06-22', quiet_day: false, headline_top: goodItem, categories: [{ items: [bad] }] };
  assert.equal(validateIssue(issue).valid, false);
});

test('ideas が空配列だと invalid', () => {
  const bad = { ...goodItem, ideas: [] };
  const issue = { date: '2026-06-22', quiet_day: false, headline_top: goodItem, categories: [{ items: [bad] }] };
  assert.equal(validateIssue(issue).valid, false);
});
