/**
 * 生成专辑页的占位素材：
 *  - images/albums/1..6.svg  抽象封面源文件（后续可直接替换成真实图片）
 *  - audio/placeholder.wav   4 秒柔和和弦，用于演示播放器（后续可替换成真实音频）
 *
 * 注意：页面实际加载的是 images/albums/1..6.jpg（位图）。
 * 3D 旋转时 SVG 会被逐帧重新栅格化，实测会掉到 30fps；
 * 改成 800×800 的 JPEG 之后 30 秒采样稳定 60fps。
 * 需要重新生成位图时：先用无头浏览器把 SVG 截成 800×800 PNG，再转成 JPEG。
 *
 * 用法: node tools/gen-albums.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const coverDir = join(root, 'images', 'albums');
const audioDir = join(root, 'audio');

/* ---------------- 封面 ---------------- */
const palettes = [
  { from: '#3b0d5c', to: '#12021f', accent: '#ff4fa3', glow: '#7b2ff7' }, // NEON DREAM
  { from: '#04263d', to: '#010c17', accent: '#38e1ff', glow: '#0e7490' }, // OCEAN ECHO
  { from: '#4a2410', to: '#160a04', accent: '#ffb454', glow: '#f59e0b' }, // GOLDEN HOUR
  { from: '#1b2431', to: '#070a0f', accent: '#a3e635', glow: '#475569' }, // URBAN PULSE
  { from: '#0b1030', to: '#03040c', accent: '#9db4ff', glow: '#3b5bdb' }, // STARFIELD
  { from: '#2a0b33', to: '#0a020f', accent: '#c084fc', glow: '#6d28d9' }, // MIDNIGHT
];

const cover = (p, index) => {
  const ringCount = 3 + (index % 2);
  const rings = Array.from({ length: ringCount }, (_, i) => {
    const r = 140 + i * 34;
    return `<circle cx="300" cy="300" r="${r}" fill="none" stroke="${p.accent}" stroke-opacity="${0.22 - i * 0.05}" stroke-width="1.2"/>`;
  }).join('\n    ');

  const sparks = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + index;
    const dist = 120 + (i % 5) * 38;
    const x = 300 + Math.cos(angle) * dist;
    const y = 300 + Math.sin(angle) * dist;
    const size = 1 + (i % 3);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size}" fill="${p.accent}" fill-opacity="${0.5 - (i % 4) * 0.08}"/>`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="专辑封面占位图 ${index + 1}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.from}"/>
      <stop offset="1" stop-color="${p.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="32%" cy="26%" r="62%">
      <stop offset="0" stop-color="${p.glow}" stop-opacity="0.85"/>
      <stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="disc" cx="50%" cy="42%" r="55%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>

  <rect width="600" height="600" fill="url(#bg)"/>
  <rect width="600" height="600" fill="url(#glow)"/>
  <circle cx="${120 + index * 30}" cy="${470 - index * 18}" r="150" fill="${p.accent}" fill-opacity="0.16" filter="url(#soft)"/>

  <circle cx="300" cy="300" r="196" fill="#05050a" fill-opacity="0.55"/>
  <circle cx="300" cy="300" r="196" fill="url(#disc)"/>
  ${rings}
  <circle cx="300" cy="300" r="16" fill="${p.accent}" fill-opacity="0.9"/>
  <circle cx="300" cy="300" r="5" fill="#05050a"/>

  ${sparks}
</svg>
`;
};

/* ---------------- 演示音频 ---------------- */
const RATE = 22050;
const SECONDS = 4;

function buildWav() {
  const total = Math.floor(RATE * SECONDS);
  const samples = new Float32Array(total);
  const notes = [220, 277.18, 329.63]; // A 小三和弦

  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;

    // 起音 0.35s、收尾 0.9s 的包络，避免爆音
    const attack = Math.min(1, t / 0.35);
    const release = Math.min(1, (SECONDS - t) / 0.9);
    const env = Math.max(0, Math.min(attack, release));
    const tremolo = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.5 * t);

    let value = 0;
    for (const freq of notes) {
      value += Math.sin(2 * Math.PI * freq * t + freq * 0.01);
      value += 0.25 * Math.sin(2 * Math.PI * freq * 2 * t);
    }
    samples[i] = (value / notes.length) * 0.22 * env * tremolo;
  }

  const buffer = Buffer.alloc(44 + total * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + total * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(total * 2, 40);
  for (let i = 0; i < total; i += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return buffer;
}

await mkdir(coverDir, { recursive: true });
await mkdir(audioDir, { recursive: true });

for (let i = 0; i < palettes.length; i += 1) {
  await writeFile(join(coverDir, `${i + 1}.svg`), cover(palettes[i], i), 'utf8');
}
await writeFile(join(audioDir, 'placeholder.wav'), buildWav());

console.log(`已生成 ${palettes.length} 张封面 + audio/placeholder.wav（${SECONDS}s）`);
