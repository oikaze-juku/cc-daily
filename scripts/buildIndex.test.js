import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex } from './buildIndex.js';

test('新しい順に並べ、日付以外は除外する', () => {
  const idx = buildIndex(['2026-06-20.json', '2026-06-22.json', 'manifest.json', 'README.md', '2026-06-21.json']);
  assert.deepEqual(idx.map((i) => i.date), ['2026-06-22', '2026-06-21', '2026-06-20']);
  assert.equal(idx[0].path, 'issues/2026-06-22.json');
});

test('夫婦別プロファイル：中間ファイル（.pool.json / .wife.json）は夫manifestの索引から除外する', () => {
  const idx = buildIndex([
    '2026-06-30.json',
    '2026-06-30.pool.json',
    '2026-06-30.wife.json',
    'manifest.json',
  ]);
  assert.deepEqual(idx.map((i) => i.date), ['2026-06-30']);
});
