import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, isReorderOnly } from './checkProfile.js';

test('正常な profile は ok', () => {
  assert.equal(validateProfile({ interest_tags: ['塾管理', 'アプリ開発'] }).ok, true);
});

test('interest_tags が配列でないと ng', () => {
  assert.equal(validateProfile({ interest_tags: 'x' }).ok, false);
});

test('空配列は ng', () => {
  assert.equal(validateProfile({ interest_tags: [] }).ok, false);
});

test('重複タグは ng', () => {
  const r = validateProfile({ interest_tags: ['a', 'a'] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('duplicate')));
});

test('空文字エントリは ng', () => {
  assert.equal(validateProfile({ interest_tags: ['a', ''] }).ok, false);
});

test('並べ替えのみ（集合不変）は isReorderOnly=true', () => {
  assert.equal(isReorderOnly(['a', 'b', 'c'], ['c', 'a', 'b']), true);
});

test('タグが増減したら isReorderOnly=false', () => {
  assert.equal(isReorderOnly(['a', 'b'], ['a', 'b', 'c']), false);
  assert.equal(isReorderOnly(['a', 'b', 'c'], ['a', 'b']), false);
});

test('別タグへの差し替えは isReorderOnly=false', () => {
  assert.equal(isReorderOnly(['a', 'b'], ['a', 'x']), false);
});
