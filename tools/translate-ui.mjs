/**
 * 把页面里所有「会显示给用户的中文」换成英文。
 * 用法: node tools/translate-ui.mjs
 * 只改界面文案（按钮、提示、占位符、aria-label、空状态、背景名），不动代码注释和专辑/歌曲名。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const pairs = [
  // 数据 / 存储
  ['保存失败：本地存储空间可能已满', 'Could not save: local storage is full'],
  ['图片读取失败', 'Could not read the image'],
  ['浏览器不支持 IndexedDB', 'This browser does not support IndexedDB'],
  ['缺少 albums', 'missing albums'],

  // 专辑卡片
  ['${album.title}，${album.sub}，查看曲目', '${album.title}, ${album.sub}, view tracks'],
  ['删除专辑 ${escapeHtml(album.title)}', 'Delete album ${escapeHtml(album.title)}'],

  // 通用小弹窗
  ['>取消<', '>Cancel<'],
  ['>删除<', '>Delete<'],

  // 导出 / 导入
  ['已导出 JSON（本地音频不包含在内）', 'Exported JSON (local audio files are not included)'],
  ['已导入，正在刷新…', 'Imported — reloading…'],
  ['导入失败：文件格式不对', 'Import failed: invalid file'],
  ['>导出<', '>Export<'],
  ['>导入<', '>Import<'],
  ['>恢复默认<', '>Reset<'],

  // 新增专辑
  ["ringKey === 'inner' ? '内圈' : '外圈'", "ringKey === 'inner' ? 'Inner ring' : 'Outer ring'"],
  ['新增专辑 · ${ringName}', 'New album · ${ringName}'],
  ['<span>专辑名</span>', '<span>Album title</span>'],
  ['例如：MIDNIGHT DRIVE', 'e.g. MIDNIGHT DRIVE'],
  ['<span>风格</span>', '<span>Genre</span>'],
  ['选填，例如：合成器浪潮', 'Optional, e.g. Synthwave'],
  ['<span>封面</span>', '<span>Cover</span>'],
  ['不选则使用渐变占位封面', 'Leave empty to use a gradient placeholder'],
  ['>添加<', '>Add<'],
  ["|| '未分类'", "|| 'Uncategorized'"],
  ['已添加专辑《${title}》，点开封面可加歌', 'Added "${title}" — open it to add tracks'],
  ['至少保留一张专辑', 'Keep at least one album'],
  ['删除专辑《${album.title}》？', 'Delete the album "${album.title}"?'],
  ['这张专辑和它下面的曲目都会被移除。', 'The album and all of its tracks will be removed.'],
  ['已删除专辑', 'Album deleted'],

  // 详情
  ['${album.sub} · ${album.year} · 共 ${album.tracks.length} 首', '${album.sub} · ${album.year} · ${album.tracks.length} tracks'],

  // 曲目
  ['删除歌曲 ${escapeHtml(track.title)}', 'Delete track ${escapeHtml(track.title)}'],
  ['<li class="track-empty">还没有曲目</li>', '<li class="track-empty">No tracks yet</li>'],
  ['＋ 添加歌曲', '+ Add track'],
  ["editing ? '重新选择文件' : '添加歌曲'", "editing ? 'Choose the file again' : 'Add a track'"],
  ["editing ? '原来的文件已失效，重新选一首并覆盖它' : `添加到《${escapeHtml(album.title)}》`",
    "editing ? 'The original file is gone — pick it again to replace it' : `Add to \"${escapeHtml(album.title)}\"`"],
  ['<span>音频文件</span>', '<span>Audio file</span>'],
  ['从电脑里选一首（mp3 / flac / m4a / wav）；不选则用演示音频', 'Pick a file from your computer (mp3 / flac / m4a / wav); without one a demo tone is used'],
  ['<span>歌曲名</span>', '<span>Track title</span>'],
  ['选文件后自动填入', 'Filled in from the file'],
  ['<span>时长</span>', '<span>Duration</span>'],
  ['自动读取，也可手填 3:45', 'Read automatically, or type 3:45'],
  ["editing ? '替换' : '添加'", "editing ? 'Replace' : 'Add'"],
  ["'已添加并存入本地' : '已添加（刷新页面后需重新选择文件）'", "'Added and saved in this browser' : 'Added (pick the file again after a reload)'"],
  [": '已添加歌曲'", ": 'Track added'"],
  ['已删除歌曲', 'Track deleted'],
  ['这个本地文件需要重新选择（刷新页面或清理浏览器后失效）', 'This local file must be picked again (it is lost after a reload or clearing browser data)'],

  // 播放器
  ["playing ? '暂停' : '播放'", "playing ? 'Pause' : 'Play'"],
  ["'❚❚ 暂停' : '▶ 播放整张'", "'❚❚ Pause' : '▶ Play album'"],
  ['这张专辑还没有歌曲', 'This album has no tracks yet'],

  // 背景
  ["name: '午夜星空'", "name: 'Midnight'"],
  ["name: '霓虹紫'", "name: 'Neon Purple'"],
  ["name: '深海'", "name: 'Deep Sea'"],
  ["name: '落日'", "name: 'Sunset'"],
  ["name: '极简黑'", "name: 'Minimal Black'"],
  ['背景：${bg.name}', 'Background: ${bg.name}'],

  // 轮播图
  ['移除这张轮播图', 'Remove this banner'],
  ['已移除轮播图', 'Banner removed'],
  ['已添加轮播图（16:9）', 'Banner added (16:9)'],
];

const file = join(root, 'js', 'album.js');
let code = await readFile(file, 'utf8');

let ok = 0;
const missing = [];
for (const [from, to] of pairs) {
  if (!code.includes(from)) {
    missing.push(from);
    continue;
  }
  code = code.split(from).join(to);
  ok += 1;
}

await writeFile(file, code, 'utf8');

console.log(`[ok] 替换 ${ok} / ${pairs.length} 条`);
if (missing.length) {
  console.log('[warn] 没找到以下片段（可能已被改过）：');
  missing.forEach((m) => console.log('   ' + m));
}
