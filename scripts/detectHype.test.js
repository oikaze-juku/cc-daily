import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectHype } from './detectHype.js';

test('英語の煽り文を検出する', () => {
  const r = detectHype("You won't believe this — make $5000 with this one trick");
  assert.equal(r.isHype, true);
  assert.ok(r.reasons.length >= 1);
});

test('日本語の煽り文を検出する', () => {
  assert.equal(detectHype('これで月50万稼げる神ツール').isHype, true);
});

test('普通の技術文は煽りでない', () => {
  const r = detectHype('Claude Code 2.1 adds a /loop slash command for scheduled runs.');
  assert.equal(r.isHype, false);
  assert.deepEqual(r.reasons, []);
});
