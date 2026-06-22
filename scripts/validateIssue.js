// 号JSONがスキーマを満たすか検証する純粋関数（外部ライブラリ不使用）。
const TRUST = new Set(['🟩', '🟦', '🟨']);

function validateItem(item, path, errors) {
  if (typeof item.title_ja !== 'string' || !item.title_ja) errors.push(`${path}.title_ja が空`);
  if (!Array.isArray(item.summary_ja) || item.summary_ja.length !== 3) errors.push(`${path}.summary_ja は3行必須`);
  if (typeof item.url !== 'string' || !/^https?:\/\//.test(item.url)) errors.push(`${path}.url が不正`);
  if (!TRUST.has(item.trust)) errors.push(`${path}.trust が不正`);
  if (!Array.isArray(item.tags)) errors.push(`${path}.tags は配列`);
  if (typeof item.try_hint !== 'string') errors.push(`${path}.try_hint は文字列`);
  if (typeof item.source_date !== 'string' || !item.source_date) errors.push(`${path}.source_date が空（情報の日付が必要）`);
  if (typeof item.idea !== 'string' || !item.idea) errors.push(`${path}.idea が空（応用アイデアが必要）`);
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
  return { valid: errors.length === 0, errors };
}
