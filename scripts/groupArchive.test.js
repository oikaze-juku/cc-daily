import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekOfMonth, weekLabel, weekKey, groupByWeek } from './groupArchive.js';

test('weekOfMonth: 7日単位で第N週', () => {
  assert.equal(weekOfMonth(1), 1);
  assert.equal(weekOfMonth(7), 1);
  assert.equal(weekOfMonth(8), 2);
  assert.equal(weekOfMonth(14), 2);
  assert.equal(weekOfMonth(15), 3);
  assert.equal(weekOfMonth(21), 3);
  assert.equal(weekOfMonth(22), 4);
  assert.equal(weekOfMonth(28), 4);
  assert.equal(weekOfMonth(29), 5);
});

test('weekLabel: 年月＋第N週', () => {
  assert.equal(weekLabel('2026-06-22'), '2026年6月 第4週');
  assert.equal(weekLabel('2026-06-01'), '2026年6月 第1週');
  assert.equal(weekLabel('2026-12-31'), '2026年12月 第5週');
});

test('weekKey: 新しい週ほど大きい', () => {
  assert.ok(weekKey('2026-06-22') > weekKey('2026-06-01'));
  assert.ok(weekKey('2026-07-01') > weekKey('2026-06-29'));
});

test('groupByWeek: 空は空配列', () => {
  assert.deepEqual(groupByWeek([]), []);
});

test('groupByWeek: 同週はまとまり、号は新しい順', () => {
  const g = groupByWeek([
    { item: { url: 'a' }, date: '2026-06-22' },
    { item: { url: 'b' }, date: '2026-06-24' },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].label, '2026年6月 第4週');
  assert.equal(g[0].entries[0].date, '2026-06-24'); // 新しい号が先
  assert.equal(g[0].entries[1].date, '2026-06-22');
});

test('groupByWeek: 複数週は新しい週が先', () => {
  const g = groupByWeek([
    { item: { url: 'a' }, date: '2026-06-03' }, // 第1週
    { item: { url: 'b' }, date: '2026-06-22' }, // 第4週
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].label, '2026年6月 第4週');
  assert.equal(g[1].label, '2026年6月 第1週');
});

test('groupByWeek: 月またぎは別グループ', () => {
  const g = groupByWeek([
    { item: { url: 'a' }, date: '2026-05-30' },
    { item: { url: 'b' }, date: '2026-06-03' },
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].label, '2026年6月 第1週');
  assert.equal(g[1].label, '2026年5月 第5週');
});
