// profile.json の構造検証（夜TUNE「4.確かめる」で使う）。
// 並べ替えで profile.json を壊していないかを PR を出す前に機械チェックする。
//
// 使い方: node scripts/checkProfile.js [profile.json]
//   OK なら exit 0、壊れていれば理由を印字して exit 1。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 純粋関数（テスト対象）：profile の interest_tags が健全か
export function validateProfile(profile) {
  const errors = [];
  if (!profile || typeof profile !== 'object') {
    return { ok: false, errors: ['profile is not an object'] };
  }
  const tags = profile.interest_tags;
  if (!Array.isArray(tags)) {
    errors.push('interest_tags is not an array');
  } else {
    if (tags.length === 0) errors.push('interest_tags is empty');
    if (tags.some((t) => typeof t !== 'string' || !t.trim())) {
      errors.push('interest_tags has a non-string or empty entry');
    }
    if (new Set(tags).size !== tags.length) errors.push('interest_tags has duplicates');
  }
  return { ok: errors.length === 0, errors };
}

// 並べ替え不変条件：タグ集合が変わっていない（順序だけ変わった）かを検証
export function isReorderOnly(beforeTags, afterTags) {
  const a = [...(beforeTags || [])].sort();
  const b = [...(afterTags || [])].sort();
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

function main() {
  const path = process.argv[2] || 'profile.json';
  let profile;
  try {
    profile = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    process.stdout.write(`NG: ${path} parse error: ${e.message}\n`);
    process.exit(1);
  }
  const { ok, errors } = validateProfile(profile);
  if (ok) {
    process.stdout.write(`OK: ${path} interest_tags=${profile.interest_tags.length}\n`);
  } else {
    process.stdout.write(`NG: ${errors.join('; ')}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
