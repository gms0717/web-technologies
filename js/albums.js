/* =========================================================
   albums.js — 专辑数据
   替换真实内容时只需要改这里：
   - cover 指向 images/albums/ 下的图片
   - tracks[].src 指向音频文件（没有 src 时会使用演示音频）
   ========================================================= */
window.ALBUMS = [
  {
    id: 'neon-dream',
    title: 'NEON DREAM',
    sub: '合成器浪潮',
    year: 2024,
    accent: '#ff4fa3',
    cover: 'images/albums/1.svg',
    tracks: [
      { title: 'Neon Highway', duration: '3:42' },
      { title: 'Chrome Hearts', duration: '4:05' },
      { title: 'Afterglow Drive', duration: '3:18' },
      { title: 'Midnight Signal', duration: '4:27' },
      { title: 'Last Arcade', duration: '3:55' },
    ],
  },
  {
    id: 'ocean-echo',
    title: 'OCEAN ECHO',
    sub: '氛围电子',
    year: 2023,
    accent: '#38e1ff',
    cover: 'images/albums/2.svg',
    tracks: [
      { title: 'Tidal Drift', duration: '5:12' },
      { title: 'Blue Hour', duration: '4:38' },
      { title: 'Salt & Static', duration: '3:56' },
      { title: 'Deep Current', duration: '6:04' },
      { title: 'Shoreline', duration: '4:21' },
    ],
  },
  {
    id: 'golden-hour',
    title: 'GOLDEN HOUR',
    sub: '独立民谣',
    year: 2022,
    accent: '#ffb454',
    cover: 'images/albums/3.svg',
    tracks: [
      { title: 'Amber Fields', duration: '3:34' },
      { title: 'Paper Lanterns', duration: '4:02' },
      { title: 'Slow Train Home', duration: '3:47' },
      { title: 'Honey Light', duration: '3:12' },
      { title: 'Evening Choir', duration: '4:44' },
    ],
  },
  {
    id: 'urban-pulse',
    title: 'URBAN PULSE',
    sub: '都市节拍',
    year: 2024,
    accent: '#a3e635',
    cover: 'images/albums/4.svg',
    tracks: [
      { title: 'Concrete Beat', duration: '3:28' },
      { title: 'Crosswalk', duration: '2:58' },
      { title: 'Skyline Run', duration: '3:41' },
      { title: 'Night Shift', duration: '4:10' },
      { title: 'Last Metro', duration: '3:33' },
    ],
  },
  {
    id: 'starfield',
    title: 'STARFIELD',
    sub: '太空环境音',
    year: 2021,
    accent: '#9db4ff',
    cover: 'images/albums/5.svg',
    tracks: [
      { title: 'Orbit', duration: '5:48' },
      { title: 'Solar Wind', duration: '6:22' },
      { title: 'Pale Blue', duration: '4:57' },
      { title: 'Event Horizon', duration: '7:05' },
      { title: 'Reentry', duration: '5:16' },
    ],
  },
  {
    id: 'midnight',
    title: 'MIDNIGHT',
    sub: '深夜爵士',
    year: 2020,
    accent: '#c084fc',
    cover: 'images/albums/6.svg',
    tracks: [
      { title: 'Blue Lantern', duration: '4:26' },
      { title: 'Smoke & Brass', duration: '3:58' },
      { title: 'After Hours', duration: '5:02' },
      { title: 'Velvet Room', duration: '4:35' },
      { title: 'Closing Time', duration: '3:49' },
    ],
  },
];

/** 没有真实音频时使用的 4 秒演示音频 */
window.PLACEHOLDER_AUDIO = 'audio/placeholder.wav';
