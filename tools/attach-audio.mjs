#!/usr/bin/env node
/**
 * 给某张专辑里的某首歌挂上音频文件。
 *
 * 用法:
 *   node tools/attach-audio.mjs <专辑名> <曲目名> <音频相对路径> [时长 mm:ss]
 *
 * 例:
 *   node tools/attach-audio.mjs 意外 其实 "audio/其实-薛之谦.mp3" 4:02
 *
 * 会重写 js/albums.js 并把版本号更新成当前时间，
 * 这样访客下次打开会自动换成最新数据（旧的浏览器缓存会被丢弃）。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [albumTitle, trackTitle, src, duration] = process.argv.slice(2);

if (!albumTitle || !trackTitle || !src) {
  console.error('用法: node tools/attach-audio.mjs <专辑名> <曲目名> <音频相对路径> [时长 mm:ss]');
  process.exitCode = 1;
  process.exit();
}

const file = join(root, 'js', 'albums.js');
const code = await readFile(file, 'utf8');

const sandbox = { window: {} };
vm.runInNewContext(code, sandbox);
const data = sandbox.window;

const album = (data.ALBUMS || []).find((item) => item.title === albumTitle);
if (!album) {
  console.error(`没有找到专辑「${albumTitle}」`);
  process.exitCode = 1;
  process.exit();
}

let track = album.tracks.find((item) => item.title === trackTitle);
let action = '更新';
if (!track) {
  track = { title: trackTitle, duration: duration || '', src };
  album.tracks.push(track);
  action = '新增';
} else {
  track.src = src;
  if (duration) track.duration = duration;
}

const version = new Date().toISOString();
const body = `/**
 * 由 tools/apply-export.mjs / tools/attach-audio.mjs 生成，请勿手改。
 * 生成时间：${version}
 */
window.ALBUMS_VERSION = ${JSON.stringify(version)};

window.ALBUMS = ${JSON.stringify(data.ALBUMS, null, 2)};

/* 轮播图（文件夹里的相对路径） */
window.DEFAULT_BANNERS = ${JSON.stringify(data.DEFAULT_BANNERS || [])};

/* 默认背景：自定义图优先，否则用第 N 套预设 */
window.DEFAULT_BG_IMAGE = ${JSON.stringify(data.DEFAULT_BG_IMAGE || null)};
window.DEFAULT_BG = ${Number.isInteger(data.DEFAULT_BG) ? data.DEFAULT_BG : 0};
`;

await writeFile(file, body, 'utf8');

console.log(`✓ ${action}：${albumTitle} / ${trackTitle} → ${src}`);
console.log(`✓ 该专辑现有 ${album.tracks.length} 首曲目，版本号 ${version}`);
