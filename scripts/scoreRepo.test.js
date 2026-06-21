import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRepo } from './scoreRepo.js';

const asOf = new Date('2026-06-22T00:00:00Z');

test('健全なリポは🟦', () => {
  const r = scoreRepo({ pushedAt: '2026-06-10T00:00:00Z', stars: 500, forks: 60, license: 'MIT' }, asOf);
  assert.equal(r.label, '🟦');
});

test('1年以上更新なしは🟨', () => {
  const r = scoreRepo({ pushedAt: '2025-01-01T00:00:00Z', stars: 500, forks: 60, license: 'MIT' }, asOf);
  assert.equal(r.label, '🟨');
});

test('偽スター疑い（★多・fork極小）は🟨', () => {
  const r = scoreRepo({ pushedAt: '2026-06-10T00:00:00Z', stars: 5000, forks: 10, license: 'MIT' }, asOf);
  assert.equal(r.label, '🟨');
  assert.ok(r.reasons.some((x) => x.includes('偽スター')));
});

test('ライセンス無しは🟨', () => {
  const r = scoreRepo({ pushedAt: '2026-06-10T00:00:00Z', stars: 100, forks: 30, license: null }, asOf);
  assert.equal(r.label, '🟨');
});
