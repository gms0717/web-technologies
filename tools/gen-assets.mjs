/**
 * 生成站点所需的本地 SVG 素材（商品占位图 / 站点图标）。
 * 全部为本地矢量文件：离线可用、无版权风险、体积小。
 *
 * 用法: node tools/gen-assets.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'images', 'products');

/** 每件商品：文件名、无障碍标签、渐变起止色、中心图形 */
const products = [
  { file: 'p1.svg',  label: '手机',     from: '#2b2f38', to: '#0b0d12', glyph: '📱' },
  { file: 'p2.svg',  label: '手机',     from: '#4b5563', to: '#1f2937', glyph: '📱' },
  { file: 'p3.svg',  label: '笔记本',   from: '#5b8def', to: '#2b4fd8', glyph: '💻' },
  { file: 'p4.svg',  label: '笔记本',   from: '#6b7280', to: '#374151', glyph: '💻' },
  { file: 'p5.svg',  label: '空调',     from: '#38bdf8', to: '#0369a1', glyph: '❄️' },
  { file: 'p6.svg',  label: '洗衣机',   from: '#60a5fa', to: '#1d4ed8', glyph: '🧺' },
  { file: 'p7.svg',  label: '空调',     from: '#22d3ee', to: '#0e7490', glyph: '❄️' },
  { file: 'p8.svg',  label: '耳机',     from: '#374151', to: '#111827', glyph: '🎧' },
  { file: 'p9.svg',  label: '吸尘器',   from: '#a855f7', to: '#6d28d9', glyph: '🧹' },
  { file: 'p10.svg', label: '鼠标',     from: '#6b7280', to: '#111827', glyph: '🖱️' },
  { file: 'p11.svg', label: '电饭煲',   from: '#fbbf24', to: '#d97706', glyph: '🍚' },
  { file: 'p12.svg', label: '破壁机',   from: '#34d399', to: '#059669', glyph: '🥤' },
  { file: 'p13.svg', label: '跑步鞋',   from: '#fb7185', to: '#be123c', glyph: '👟' },
  { file: 'p14.svg', label: '羽绒服',   from: '#93c5fd', to: '#1e40af', glyph: '🧥' },
  { file: 'p15.svg', label: '饮用水',   from: '#7dd3fc', to: '#0284c7', glyph: '💧' },
  { file: 'p16.svg', label: '坚果',     from: '#fcd34d', to: '#b45309', glyph: '🥜' },
  { file: 'p17.svg', label: '图书',     from: '#fca5a5', to: '#b91c1c', glyph: '📚' },
  { file: 'p18.svg', label: '洁面乳',   from: '#f9a8d4', to: '#be185d', glyph: '🧴' },
];

const svg = ({ label, from, to, glyph }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="${label}商品图">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="light" cx="50%" cy="32%" r="62%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <rect width="400" height="400" fill="url(#light)"/>
  <circle cx="336" cy="64" r="96" fill="#ffffff" opacity="0.08"/>
  <circle cx="58" cy="342" r="126" fill="#ffffff" opacity="0.06"/>
  <rect x="108" y="108" width="184" height="184" rx="44" fill="#ffffff" opacity="0.94"/>
  <text x="200" y="200" font-size="104" text-anchor="middle" dominant-baseline="central"
        font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${glyph}</text>
</svg>
`;

/** 站点图标：中性品牌“优”，不使用任何平台标识 */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="16" fill="#e8453c"/>
  <text x="32" y="33" font-size="34" font-weight="700" fill="#fff" text-anchor="middle"
        dominant-baseline="central" font-family="Microsoft YaHei, PingFang SC, sans-serif">优</text>
</svg>
`;

await mkdir(outDir, { recursive: true });
for (const p of products) {
  await writeFile(join(outDir, p.file), svg(p), 'utf8');
}
await writeFile(join(root, 'images', 'favicon.svg'), favicon, 'utf8');
console.log(`已生成 ${products.length} 张商品图 + favicon.svg`);
