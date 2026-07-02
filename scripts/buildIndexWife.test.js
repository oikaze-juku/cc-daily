import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndexWife } from './buildIndexWife.js';

test('新しい順に並べ、*.wife.json 以外は除外する', () => {
  const idx = buildIndexWife([
    '2026-06-20.wife.json',
    '2026-06-22.wife.json',
    '2026-06-21.wife.json',
    '2026-06-22.json',
    '2026-06-22.pool.json',
    'manifest.json',
    'README.md',
  ]);
  assert.deepEqual(idx.map((i) => i.date), ['2026-06-22', '2026-06-21', '2026-06-20']);
  assert.equal(idx[0].path, 'issues/2026-06-22.wife.json');
});

test('*.wife.json が無ければ空配列', () => {
  assert.deepEqual(buildIndexWife(['2026-06-22.json', 'manifest.json']), []);
});
