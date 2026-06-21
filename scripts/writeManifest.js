// issues/ を読み、buildIndex で索引化して issues/manifest.json を書き出す。
import { readdirSync, writeFileSync } from 'node:fs';
import { buildIndex } from './buildIndex.js';

const files = readdirSync('issues');
const index = buildIndex(files);
writeFileSync('issues/manifest.json', JSON.stringify(index, null, 2) + '\n');
console.log(`manifest 更新: ${index.length} 号`);
