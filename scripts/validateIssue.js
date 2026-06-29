// 号JSONがスキーマを満たすか検証する純粋関数（外部ライブラリ不使用）。
const TRUST = new Set(['🟩', '🟨', '🟥']);

function validateItem(item, path, errors) {
  if (typeof item.title_ja !== 'string' || !item.title_ja) errors.push(`${path}.title_ja が空`);
  if (!Array.isArray(item.summary_ja) || item.summary_ja.length !== 3) errors.push(`${path}.summary_ja は3行必須`);
  if (typeof item.url !== 'string' || !/^https?:\/\//.test(item.url)) errors.push(`${path}.url が不正`);
  if (!TRUST.has(item.trust)) errors.push(`${path}.trust が不正`);
  if (!Array.isArray(item.tags)) errors.push(`${path}.tags は配列`);
  if (typeof item.try_hint !== 'string') errors.push(`${path}.try_hint は文字列`);
  if (typeof item.source_date !== 'string' || !item.source_date) errors.push(`${path}.source_date が空（情報の日付が必要）`);
  // 記事本文は画面に表示される必須項目（何が新しく加わり各機能は何か）。空配列・空文字は不可。
  const articleArr = Array.isArray(item.article) ? item.article : (item.article ? [item.article] : []);
  if (articleArr.length === 0 || !articleArr.every((s) => typeof s === 'string' && s.trim())) {
    errors.push(`${path}.article は本文1段落以上が必須（記事本文）`);
  }
}

export function validateIssue(issue) {
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue.date || '')) errors.push('date が YYYY-MM-DD でない');
  if (typeof issue.quiet_day !== 'boolean') errors.push('quiet_day は真偽値');
  if (!Array.isArray(issue.categories)) errors.push('categories は配列');
  if (!issue.quiet_day && !issue.headline_top) errors.push('通常日は headline_top 必須');
  if (issue.headline_top) validateItem(issue.headline_top, 'headline_top', errors);
  (issue.categories || []).forEach((cat, ci) => {
    (cat.items || []).forEach((it, ii) => validateItem(it, `categories[${ci}].items[${ii}]`, errors));
  });
  if (!issue.quiet_day) {
    const howtoItems = (issue.categories || [])
      .filter(c => c.key === 'howto')
      .flatMap(c => c.items || []);
    if (howtoItems.length === 0) {
      errors.push('通常日は howto（実践・活用事例）が 1 件以上必須。第1〜3段の探索が不足している');
    }
  }
  const officialTotal = (issue.categories || [])
    .filter(c => c.key === 'official')
    .flatMap(c => c.items || []).length;
  if (officialTotal > 1) {
    errors.push('official（重要ニュース）は最大1件。公式アップデートで枠を埋めてはいけない');
  }
  return { valid: errors.length === 0, errors };
}
