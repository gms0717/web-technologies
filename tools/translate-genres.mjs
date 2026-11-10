/**
 * 把专辑风格里的中文换成英文（流行 -> Pop）。
 * 用法: node tools/translate-genres.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'js', 'albums.js');

const map = {
  流行: 'Pop',
  流行摇滚: 'Pop Rock',
  实验电子: 'Experimental Electronic',
  合成器浪潮: 'Synthwave',
  未分类: 'Uncategorized',
};

let code = await readFile(file, 'utf8');
let total = 0;

for (const [zh, en] of Object.entries(map)) {
  const needle = `"sub": "${zh}"`;
  const hits = code.split(needle).length - 1;
  if (hits) {
    code = code.split(needle).join(`"sub": ${JSON.stringify(en)}`);
    total += hits;
    console.log(`  ${zh} -> ${en}   ${hits} 处`);
  }
}

await writeFile(file, code, 'utf8');
console.log(`[ok] 共替换 ${total} 处风格`);
