/**
 * 静态自检：检查页面引用的本地文件是否存在（脚本 / 样式 / 图片 / 页面跳转）。
 * 用法: node tools/check-links.mjs
 */
import { readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'orders.html', 'messages.html', 'profile.html'];
// 只有商城页面使用 data.js / common.js；index.html 现在是独立的专辑页
const shopPages = ['orders.html', 'messages.html', 'profile.html'];
const attrPattern = /(?:href|src)\s*=\s*"([^"]+)"/g;

let checked = 0;
const missing = [];

for (const page of pages) {
  const html = await readFile(join(root, page), 'utf8');
  for (const match of html.matchAll(attrPattern)) {
    const url = match[1];
    if (/^(https?:|mailto:|tel:|data:|#)/.test(url)) continue;

    const clean = url.split('?')[0].split('#')[0];
    if (!clean) continue;

    try {
      await access(resolve(root, clean));
      checked += 1;
    } catch {
      missing.push(`${page} -> ${url}`);
    }
  }
}

// 商品图：data.js 里每个商品都应该有对应的 SVG
const dataSource = await readFile(join(root, 'js/data.js'), 'utf8');
const productIds = [...new Set([...dataSource.matchAll(/id:\s*'(p\d+)'/g)].map((m) => m[1]))];

for (const id of productIds) {
  try {
    await access(join(root, 'images', 'products', `${id}.svg`));
    checked += 1;
  } catch {
    missing.push(`images/products/${id}.svg（商品图缺失）`);
  }
}

// 商城页面都应引入数据层与公共脚本
for (const page of shopPages) {
  const html = await readFile(join(root, page), 'utf8');
  for (const script of ['js/data.js', 'js/common.js']) {
    if (!html.includes(script)) missing.push(`${page} 缺少 ${script}`);
  }
}

// 专辑页应引入自己的数据与脚本
const albumHtml = await readFile(join(root, 'index.html'), 'utf8');
for (const script of ['js/albums.js', 'js/album.js', 'css/album.css']) {
  if (!albumHtml.includes(script)) missing.push(`index.html 缺少 ${script}`);
}

if (missing.length) {
  console.log(`检查了 ${checked} 个引用，发现 ${missing.length} 个问题：`);
  missing.forEach((item) => console.log('  ✗ ' + item));
  process.exitCode = 1;
} else {
  console.log(`检查通过：${checked} 个本地引用全部存在（页面 ${pages.length} 个，商品图 ${productIds.length} 张）`);
}
