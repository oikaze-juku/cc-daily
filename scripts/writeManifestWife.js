// issues/ を読み、buildIndexWife で妻用の号（*.wife.json）だけを索引化して
// issues/manifest.wife.json を書き出す。writeManifest.js（夫用）の妻版。
import { readdirSync, writeFileSync } from 'node:fs';
import { buildIndexWife } from './buildIndexWife.js';

const files = readdirSync('issues');
const index = buildIndexWife(files);
writeFileSync('issues/manifest.wife.json', JSON.stringify(index, null, 2) + '\n');
console.log(`manifest.wife 更新: ${index.length} 号`);
