#!/usr/bin/env node
/**
 * 把「导出数据」的 JSON 固化成站点默认数据。
 *
 * 用法: node tools/apply-export.mjs "D:/应用/album-data-2026-11-08.json"
 *
 * 做三件事：
 *   1. 把 JSON 里内嵌的图片（专辑封面、轮播图、自定义背景）解出来存成文件，
 *      避免把几 MB 的 base64 塞进 js/albums.js 拖慢首屏
 *   2. 重写 js/albums.js：window.ALBUMS / ALBUMS_VERSION / DEFAULT_BANNERS / DEFAULT_BG / DEFAULT_BG_IMAGE
 *   3. 版本号取当前时间，老访客下次打开会自动丢弃旧缓存、换成这套数据
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) {
  console.error('用法: node tools/apply-export.mjs <导出的 json 路径>');
  process.exitCode = 1;
  process.exit();
}

const DATA_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function parseDataUrl(value) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(value || '');
  if (!match) return null;
  return { type: match[1], buffer: Buffer.from(match[2], 'base64') };
}

/** 背景存的是 CSS 写法（url("data:...") center/cover），先把 data URL 抠出来 */
function extractDataUrl(value) {
  const match = /url\("(data:[^"]+)"\)/.exec(value || '');
  return match ? match[1] : value;
}

async function saveImage(value, dir, name) {
  const parsed = parseDataUrl(value);
  if (!parsed) return null;

  const ext = DATA_EXT[parsed.type] || 'jpg';
  const rel = join(dir, `${name}.${ext}`).replace(/\\/g, '/');
  await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, rel), parsed.buffer);
  return rel;
}

async function main() {
  const json = JSON.parse(await readFile(source, 'utf8'));
  if (!Array.isArray(json.albums) || !json.albums.length) {
    throw new Error('JSON 里没有 albums');
  }

  let counter = 0;

  // 专辑封面
  for (const album of json.albums) {
    counter += 1;
    const saved = await saveImage(album.cover, 'images/albums', `up-${counter}`);
    if (saved) album.cover = saved;
    else if (!album.cover) album.cover = `images/albums/${(counter % 6) + 1}.jpg`;
    if (album.ring !== 'inner') album.ring = 'outer';
  }

  // 轮播图
  const banners = [];
  let bannerIndex = 0;
  for (const banner of json.banners || []) {
    bannerIndex += 1;
    const saved = await saveImage(banner, 'images/banners', `up-${bannerIndex}`);
    if (saved) banners.push(saved);
    else if (typeof banner === 'string' && !banner.startsWith('data:')) banners.push(banner);
  }

  // 自定义背景
  let bgImage = null;
  if (json.bgImage) {
    const saved = await saveImage(extractDataUrl(json.bgImage), 'images/bg', 'custom');
    if (saved) bgImage = `url("${saved}") center / cover no-repeat`;
  }

  const version = new Date().toISOString();
  const body = `/**
 * 由 tools/apply-export.mjs 从导出的数据生成，请勿手改。
 * 来源：${source.replace(/\\/g, '/')}
 * 生成时间：${version}
 */
window.ALBUMS_VERSION = ${JSON.stringify(version)};

window.ALBUMS = ${JSON.stringify(json.albums, null, 2)};

/* 轮播图（文件夹里的相对路径） */
window.DEFAULT_BANNERS = ${JSON.stringify(banners)};

/* 默认背景：自定义图优先，否则用第 N 套预设 */
window.DEFAULT_BG_IMAGE = ${JSON.stringify(bgImage)};
window.DEFAULT_BG = ${Number.isInteger(json.bgPreset) ? json.bgPreset : 0};
`;

  await writeFile(join(root, 'js', 'albums.js'), body, 'utf8');

  const trackCount = json.albums.reduce((sum, album) => sum + (album.tracks?.length || 0), 0);
  console.log(`✓ ${json.albums.length} 张专辑 / ${trackCount} 首曲目`);
  console.log(`✓ ${banners.length} 张轮播图`);
  console.log(`✓ 背景：${bgImage ? '自定义图片' : `预设 ${json.bgPreset}`}`);
  console.log(`✓ 已写入 js/albums.js（版本 ${version}）`);
}

main().catch((err) => {
  console.error('生成失败：', err.message);
  process.exitCode = 1;
});
