import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectUrls } from './listUsedUrls.js';

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
