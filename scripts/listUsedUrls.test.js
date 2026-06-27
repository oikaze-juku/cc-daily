import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectUrls, recentFiles } from './listUsedUrls.js';

// --- collectUrls ---

const makeIssue = (headlineUrl, itemUrls = []) => ({
  headline_top: headlineUrl ? { url: headlineUrl } : undefined,
  categories: [{ key: 'howto', label: '', items: itemUrls.map((u) => ({ url: u })) }],
});

test('headline_top と items の URL を両方収集する', () => {
  const issues = [makeIssue('https://a.example/', ['https://b.example/', 'https://c.example/'])];
  assert.deepEqual(collectUrls(issues), [
    'https://a.example/',
    'https://b.example/',
    'https://c.example/',
  ]);
});

test('複数号をまたいで重複を排除する', () => {
  const issues = [
    makeIssue('https://a.example/', ['https://shared.example/']),
    makeIssue('https://b.example/', ['https://shared.example/']),
  ];
  const urls = collectUrls(issues);
  assert.equal(urls.filter((u) => u === 'https://shared.example/').length, 1);
});

test('headline_top が無い号も壊れない', () => {
  const issues = [{ categories: [{ key: 'howto', label: '', items: [{ url: 'https://x.example/' }] }] }];
  assert.deepEqual(collectUrls(issues), ['https://x.example/']);
});

test('カテゴリが空の号も壊れない', () => {
  const issues = [makeIssue('https://only.example/')];
  assert.deepEqual(collectUrls(issues), ['https://only.example/']);
});

test('issues が空なら空配列を返す', () => {
  assert.deepEqual(collectUrls([]), []);
});

// --- recentFiles ---

test('30日以内のファイルだけ返す', () => {
  const today = new Date('2026-07-01');
  const files = [
    '2026-07-01.json', // 0日前 → 含む
    '2026-06-15.json', // 16日前 → 含む
    '2026-06-01.json', // 30日前 → 含む（境界: cutoff = 2026-06-01）
    '2026-05-31.json', // 31日前 → 除外
    '2026-01-01.json', // 半年前 → 除外
    'manifest.json',   // 形式違い → 除外
  ];
  const result = recentFiles(files, 30, today);
  assert.deepEqual(result, ['2026-07-01.json', '2026-06-15.json', '2026-06-01.json']);
});

test('全ファイルが古ければ空配列を返す', () => {
  const today = new Date('2026-07-01');
  const result = recentFiles(['2025-01-01.json', '2024-12-31.json'], 30, today);
  assert.deepEqual(result, []);
});

test('形式違いのファイルは無視する', () => {
  const today = new Date('2026-07-01');
  const result = recentFiles(['manifest.json', 'README.md', '2026-06-30.json'], 30, today);
  assert.deepEqual(result, ['2026-06-30.json']);
});
