#!/usr/bin/env node
/**
 * 把本地音频整理成页面能直接播放的专辑数据。
 *
 * 用法：
 *   node tools/import-audio.mjs                 # 读取 audio/源/
 *   node tools/import-audio.mjs "D:/音乐/我的歌"  # 指定源目录
 *
 * 目录约定（两种都行）：
 *   audio/源/薛之谦 - 意外/01 - 丑八怪.mp3        → 一张专辑《薛之谦 - 意外》
 *   audio/源/意外/丑八怪.mp3                       → 专辑《意外》，歌手取上一层目录
 *   audio/源/丑八怪.mp3                            → 全部归到《未分类》
 *
 * 脚本会：
 *   1. 把音频复制到 audio/<专辑>/ 下（页面用相对路径就能播）
 *   2. 重写 js/albums.js（专辑、曲名、src 路径、版本号）
 *   3. 顺手跳过 .ncm 等浏览器放不了的加密格式并提示
 */
import { readdir, stat, copyFile, mkdir, writeFile, access } from 'node:fs/promises';
import { extname, basename, join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(process.argv[2] || join(root, 'audio', '源'));
const audioRoot = join(root, 'audio');

const PLAYABLE = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wav', '.webm']);
const ENCRYPTED = new Set(['.ncm', '.qmc0', '.qmc3', '.qmcflac', '.mflac', '.mgg', '.kgm']);
const COVER_NAMES = ['cover', 'folder', 'front', '封面'];

const ACCENTS = ['#ff4fa3', '#38e1ff', '#ffb454', '#a3e635', '#9db4ff', '#c084fc'];
const PLACEHOLDER_COVERS = Array.from({ length: 6 }, (_, i) => `images/albums/${i + 1}.jpg`);

const skipped = [];
const found = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (PLAYABLE.has(ext)) found.push(abs);
    else if (ENCRYPTED.has(ext)) skipped.push(abs);
  }
}

const cleanName = (value) => value.replace(/[\\/:*?"<>|]/g, '_').trim();

/** 从文件名里拆出歌名：去掉开头的序号和结尾的「 - 歌手」 */
function trackTitle(fileName) {
  let name = basename(fileName, extname(fileName));
  name = name.replace(/^\s*\d{1,3}[\s._-]+/, '');
  name = name.replace(/\s*-\s*[^-]+$/, (tail) => (tail.length > 0 ? '' : tail));
  return name.trim() || basename(fileName, extname(fileName));
}

/** 专辑 = 直接装着音频文件的那层文件夹 */
function albumKey(file) {
  const rel = relative(srcDir, file);
  const dir = dirname(rel);
  return dir === '.' ? '未分类' : dir;
}

async function main() {
  try {
    await access(srcDir);
  } catch {
    console.error(`找不到源目录：${srcDir}`);
    console.error('把音频放进 audio/源/ 再运行，或者把目录路径作为参数传入。');
    process.exitCode = 1;
    return;
  }

  await walk(srcDir);

  if (!found.length) {
    console.error(`没有在 ${srcDir} 里找到可播放的音频文件。`);
    if (skipped.length) {
      console.error(`发现 ${skipped.length} 个加密格式（.ncm 等），浏览器无法直接解码，需要先转成 mp3/flac。`);
    }
    process.exitCode = 1;
    return;
  }

  // 按专辑分组
  const groups = new Map();
  for (const file of found) {
    const key = albumKey(file);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }

  const albums = [];
  let index = 0;

  for (const [key, files] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'))) {
    const folderName = key.split(sep).pop() || '未分类';
    const parentName = key.split(sep).slice(-2, -1)[0] || '';
    const albumTitle = cleanName(folderName) || `专辑 ${index + 1}`;
    const albumDirName = cleanName(folderName) || `album-${index + 1}`;
    const outDir = join(audioRoot, albumDirName);

    await mkdir(outDir, { recursive: true });

    const tracks = [];
    const sorted = [...files].sort((a, b) => basename(a).localeCompare(basename(b), 'zh', { numeric: true }));

    for (const file of sorted) {
      const target = join(outDir, basename(file));
      await copyFile(file, target);
      tracks.push({
        title: trackTitle(file),
        duration: '--:--',
        src: `audio/${albumDirName}/${basename(file)}`.replace(/\\/g, '/'),
      });
    }

    albums.push({
      id: `local-${index}`,
      title: albumTitle,
      sub: parentName && parentName !== '未分类' ? cleanName(parentName) : '本地音乐',
      year: new Date().getFullYear(),
      accent: ACCENTS[index % ACCENTS.length],
      cover: PLACEHOLDER_COVERS[index % PLACEHOLDER_COVERS.length],
      tracks,
    });

    index += 1;
    console.log(`✓ ${albumTitle}：${tracks.length} 首`);
  }

  const version = new Date().toISOString();
  const body = `/**
 * 由 tools/import-audio.mjs 生成，请不要手改（重新导入会覆盖）。
 * 生成时间：${version}
 */
window.ALBUMS_VERSION = ${JSON.stringify(version)};

window.ALBUMS = ${JSON.stringify(albums, null, 2)};
`;

  await writeFile(join(root, 'js', 'albums.js'), body, 'utf8');

  console.log(`\n共 ${albums.length} 张专辑 / ${albums.reduce((sum, a) => sum + a.tracks.length, 0)} 首，已写入 js/albums.js`);
  if (skipped.length) {
    console.log(`\n有 ${skipped.length} 个加密音频被跳过（浏览器无法解码），例如：`);
    skipped.slice(0, 3).forEach((file) => console.log('  - ' + basename(file)));
  }
}

main().catch((err) => {
  console.error('导入失败：', err.message);
  process.exitCode = 1;
});
