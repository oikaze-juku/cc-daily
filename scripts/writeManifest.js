// issues/ を読み、buildIndex で索引化して issues/manifest.json（夫用）を書き出す。
// buildIndex は `YYYY-MM-DD.json` の完全一致のみ拾うため、Stage A/B の中間ファイル
// `*.pool.json`（探索プール）・`*.wife.json`（妻用の号）は自然に除外される。
// 妻用の索引は writeManifestWife.js が別途 issues/manifest.wife.json を生成する。
import { readdirSync, writeFileSync } from 'node:fs';
import { buildIndex } from './buildIndex.js';

const files = readdirSync('issues');
const index = buildIndex(files);
writeFileSync('issues/manifest.json', JSON.stringify(index, null, 2) + '\n');
console.log(`manifest 更新: ${index.length} 号`);
