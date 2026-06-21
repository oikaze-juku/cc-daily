import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe } from './dedupe.js';

test('既出URLを除外する', () => {
  const items = [{ url: 'a' }, { url: 'b' }, { url: 'c' }];
  assert.deepEqual(dedupe(items, ['b']).map((i) => i.url), ['a', 'c']);
});

test('既出が無ければ全件返す', () => {
  assert.deepEqual(dedupe([{ url: 'a' }], []).map((i) => i.url), ['a']);
});
