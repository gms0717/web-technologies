/* =========================================================
   album.js — 环绕专辑交互
   环形旋转 / 悬停暂停并翻开 / 增删专辑与曲目 / 播放器 / 背景切换
   ========================================================= */
(function () {
  'use strict';

  const PLACEHOLDER = window.PLACEHOLDER_AUDIO || 'audio/placeholder.wav';
  const DEFAULT_ACCENT = '#ff4fa3';
  const GAP = 44; // 相邻封面之间至少留出的弧长
  const STORE_KEY = 'album_data';
  const ACCENTS = ['#ff4fa3', '#38e1ff', '#ffb454', '#a3e635', '#9db4ff', '#c084fc'];

  const stage = document.querySelector('.stage');
  const fab = document.getElementById('fab');

  const view = document.getElementById('albumView');
  const viewBg = document.getElementById('viewBg');
  const viewTitle = document.getElementById('viewTitle');
  const viewSub = document.getElementById('viewSub');
  const trackList = document.getElementById('trackList');
  const playAlbumBtn = document.getElementById('playAlbum');

  const player = document.getElementById('player');
  const playerCover = document.getElementById('playerCover');
  const playerTitle = document.getElementById('playerTitle');
  const playerSub = document.getElementById('playerSub');
  const playerTag = document.getElementById('playerTag');
  const playBtn = document.getElementById('playBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const curTime = document.getElementById('curTime');
  const totalTime = document.getElementById('totalTime');

  const audio = new Audio();
  audio.preload = 'auto';
  window.__playerAudio = audio; // 便于自检脚本查看加载状态

  /* ---------------- 本地音频存储 ----------------
     从电脑里选的歌会尽量存进 IndexedDB（http/https 下有效，刷新后还能播）；
     file:// 打开时浏览器不给用数据库，就只在本次会话里保留（src 记为 local:<id>）。 */
  const AUDIO_DB = 'album_audio';
  const AUDIO_STORE = 'files';
  const DB_TIMEOUT = 2500;
  const localFiles = new Map(); // 本次会话里的本地文件
  let audioDB = null;
  let objectUrl = null;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  }

  function openAudioDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('浏览器不支持 IndexedDB'));
    if (!audioDB) {
      audioDB = new Promise((resolve, reject) => {
        const request = indexedDB.open(AUDIO_DB, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(AUDIO_STORE)) db.createObjectStore(AUDIO_STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return audioDB;
  }

  async function saveAudioFile(id, file) {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, 'readwrite');
      tx.objectStore(AUDIO_STORE).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadAudioFile(id) {
    const db = await openAudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, 'readonly');
      const request = tx.objectStore(AUDIO_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function deleteAudioFile(id) {
    return openAudioDB()
      .then((db) => new Promise((resolve) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        tx.objectStore(AUDIO_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      }))
      .catch(() => {});
  }

  function clearAudioFiles() {
    return openAudioDB()
      .then((db) => new Promise((resolve) => {
        const tx = db.transaction(AUDIO_STORE, 'readwrite');
        tx.objectStore(AUDIO_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      }))
      .catch(() => {});
  }

  /** 把 track.src 解析成能直接塞给 audio 的地址；返回 null 表示需要用户重新选文件 */
  async function resolveTrackSource(track) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }

    const src = track && track.src ? String(track.src) : '';
    if (!src) return PLACEHOLDER;

    // 本次会话里选的文件
    if (src.startsWith('local:')) {
      const file = localFiles.get(src.slice(6));
      if (!file) return null;
      objectUrl = URL.createObjectURL(file);
      return objectUrl;
    }

    // 存在浏览器数据库里的文件
    if (src.startsWith('idb:')) {
      try {
        const file = await withTimeout(loadAudioFile(src.slice(4)), DB_TIMEOUT);
        if (!file) return null;
        objectUrl = URL.createObjectURL(file);
        return objectUrl;
      } catch (err) {
        return null;
      }
    }

    return src;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const cards = [];
  let albums = loadAlbums();
  let viewOpen = false;
  let activeIndex = -1;
  let lastFocus = null;
  let closeTimer = null;
  const current = { album: -1, track: -1 };

  const escapeHtml = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));

  /* ---------------- 数据存取 ---------------- */
  /** 旧数据里指向 SVG 占位封面的一律换成位图（3D 旋转时位图才不卡） */
  function normalizeCover(cover) {
    return String(cover || '').replace(
      /^images\/albums\/([1-6])\.svg$/,
      'images/albums/$1.jpg'
    );
  }

  function loadAlbums() {
    // 数据文件重新生成过（版本号变化）就丢掉浏览器里的旧数据，否则导入的新歌看不到
    const version = window.ALBUMS_VERSION || '';
    try {
      if (version && localStorage.getItem(`${STORE_KEY}_ver`) !== version) {
        localStorage.removeItem(STORE_KEY);
        localStorage.setItem(`${STORE_KEY}_ver`, version);
      }
    } catch (err) {
      /* 忽略存储异常 */
    }

    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map((album, index) => ({
            ...album,
            cover: normalizeCover(album.cover),
            ring: normalizeRing(album, index),
          }));
        }
      }
    } catch (err) {
      /* 数据损坏时回落到默认专辑 */
    }

    return (window.ALBUMS || []).map((album, index) => ({
      ...album,
      cover: normalizeCover(album.cover),
      ring: normalizeRing(album, index),
      tracks: album.tracks.map((track) => ({ ...track })),
    }));
  }

  /** 老数据没有圈层字段：按奇偶分到内外两圈，让画面直接是双环 */
  function normalizeRing(album, index) {
    if (album && (album.ring === 'inner' || album.ring === 'outer')) return album.ring;
    return index % 2 === 0 ? 'outer' : 'inner';
  }

  function saveAlbums() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(albums));
      return true;
    } catch (err) {
      toast('保存失败：本地存储空间可能已满');
      return false;
    }
  }

  /* ---------------- 轻提示 ---------------- */
  let toastTimer = null;
  function toast(message) {
    let el = document.getElementById('appToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'appToast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    void el.offsetWidth;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
  }

  /* ---------------- 双层环形专辑 ---------------- */
  const RINGS = {
    outer: {
      el: document.getElementById('ringOuter'),
      cards: [],
      step: 0,
      offset: 0,
      hover: 0,
      anim: null,
      baseRadius: 445,
      maxCard: 190,
      widthRatio: 0.31,
    },
    inner: {
      el: document.getElementById('ringInner'),
      cards: [],
      step: 0,
      offset: 0.5,
      hover: 0,
      anim: null,
      baseRadius: 210,
      maxCard: 142,
      widthRatio: 0.16,
    },
  };

  /** 每一圈单独算半径和封面尺寸，保证这一圈自己不会重叠 */
  function layoutRing(ring) {
    const count = ring.cards.length;
    if (!count) return;

    const stageW = stage.clientWidth || window.innerWidth;
    const radiusMax = Math.min(ring.baseRadius, stageW * ring.widthRatio);

    let radius = (count * (ring.maxCard + GAP)) / (2 * Math.PI);
    radius = Math.min(radiusMax, Math.max(radius, radiusMax * 0.88));

    // 半径被压住时按弧长缩小封面
    const arc = (2 * Math.PI * radius) / count;
    const card = Math.min(ring.maxCard, Math.max(44, arc - GAP));

    ring.el.style.setProperty('--card', `${card.toFixed(1)}px`);
    ring.el.style.setProperty('--radius', `${radius.toFixed(1)}px`);
  }

  function buildCard(album, index, ring) {
    const card = document.createElement('div');
    card.className = 'album';
    card.dataset.index = String(index);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${album.title}，${album.sub}，查看曲目`);
    card.innerHTML = `
      <span class="album-inner">
        <img src="${album.cover}" alt="" draggable="false">
        <span class="album-meta">
          <strong>${escapeHtml(album.title)}</strong>
          <em>${escapeHtml(album.sub)}</em>
        </span>
      </span>
      <button class="album-remove" type="button" aria-label="删除专辑 ${escapeHtml(album.title)}">✕</button>
    `;

    // 悬停只暂停它所在的那一圈；背面的专辑不参与
    card.addEventListener('mouseenter', () => {
      if (card.classList.contains('is-back')) return;
      ring.hover += 1;
      syncPause();
    });
    card.addEventListener('mouseleave', () => {
      ring.hover = Math.max(0, ring.hover - 1);
      syncPause();
    });

    card.addEventListener('click', (event) => {
      if (event.target.closest('.album-remove')) return;
      if (card.classList.contains('is-back')) return; // 背面的专辑不响应点击
      openView(Number(card.dataset.index), card);
    });
    card.addEventListener('keydown', (event) => {
      if (event.target !== card) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (card.classList.contains('is-back')) return;
      event.preventDefault();
      openView(Number(card.dataset.index), card);
    });

    card.querySelector('.album-remove').addEventListener('click', (event) => {
      event.stopPropagation();
      removeAlbum(Number(card.dataset.index));
    });

    return card;
  }

  function renderRings() {
    Object.values(RINGS).forEach((ring) => {
      ring.el.innerHTML = '';
      ring.cards = [];
      ring.step = 0;
      ring.hover = 0;
      ring.anim = null;
    });

    albums.forEach((album, index) => {
      const ring = album.ring === 'inner' ? RINGS.inner : RINGS.outer;
      const card = buildCard(album, index, ring);
      ring.el.appendChild(card);
      ring.cards.push(card);
    });

    Object.values(RINGS).forEach((ring) => {
      ring.step = ring.cards.length ? 360 / ring.cards.length : 0;
      ring.cards.forEach((card, index) => {
        // 内圈错开半格，避免两张“正对面”的封面正好叠在一起
        card.style.setProperty('--angle', `${(index + ring.offset) * ring.step}deg`);
      });
      layoutRing(ring);
    });

    updateFacing();
  }

  /** 读某一圈动画当前转到的角度（暂停时冻结，方向不影响正反面判断） */
  function ringRotation(ring) {
    if (!ring.anim || ring.anim.playState === 'idle') {
      ring.anim = ring.el.getAnimations()[0] || null;
    }

    const timing = ring.anim && ring.anim.effect ? ring.anim.effect.getTiming() : null;
    const duration = timing && Number(timing.duration) > 0 ? Number(timing.duration) : 50000;
    const time = ring.anim && ring.anim.currentTime ? Number(ring.anim.currentTime) : 0;
    return (((time % duration) / duration) * 360) % 360;
  }

  /** 判断每张是否转到背面：背面压暗、隐藏文字、不响应鼠标 */
  function updateFacing() {
    Object.values(RINGS).forEach((ring) => {
      if (!ring.cards.length) return;

      const rot = ringRotation(ring);
      ring.cards.forEach((card, index) => {
        const world = ((rot + (index + ring.offset) * ring.step) * Math.PI) / 180;
        const isBack = Math.cos(world) < -0.05;
        if (card.classList.contains('is-back') !== isBack) {
          card.classList.toggle('is-back', isBack);
        }
      });
    });
  }

  /** 悬停某圈或查看详情时暂停：只切换 animation-play-state，不打断动画 */
  function syncPause() {
    Object.values(RINGS).forEach((ring) => {
      ring.el.classList.toggle('is-paused', viewOpen || ring.hover > 0);
    });
  }

  setInterval(updateFacing, 90);

  /* ---------------- 小弹窗 ---------------- */
  function confirmModal(title, text) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'mini-modal';
      modal.innerHTML = `
        <div class="mini-mask" data-close></div>
        <div class="mini-panel" role="dialog" aria-modal="true">
          <h3>${escapeHtml(title)}</h3>
          <p class="mini-text">${escapeHtml(text)}</p>
          <div class="mini-actions">
            <button type="button" class="mini-btn ghost" data-close>取消</button>
            <button type="button" class="mini-btn danger" data-ok>删除</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const finish = (value) => {
        modal.remove();
        resolve(value);
      };
      modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-ok]')) finish(true);
        else if (event.target.closest('[data-close]')) finish(false);
      });
      modal.querySelector('[data-close]').focus();
    });
  }

  /** 把上传的图片裁成 600×600 的 JPEG，避免占满 localStorage */
  function fileToCover(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        const size = 600;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;

        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;

        canvas.getContext('2d').drawImage(
          image,
          (size - width) / 2,
          (size - height) / 2,
          width,
          height
        );

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片读取失败'));
      };
      image.src = url;
    });
  }

  /* ---------------- 新增 / 删除专辑 ---------------- */
  function openAlbumForm(ringKey = 'outer') {
    const ringName = ringKey === 'inner' ? '内圈' : '外圈';

    const modal = document.createElement('div');
    modal.className = 'mini-modal';
    modal.innerHTML = `
      <div class="mini-mask" data-close></div>
      <form class="mini-panel" novalidate>
        <h3>新增专辑 · ${ringName}</h3>
        <label class="mini-field">
          <span>专辑名</span>
          <input id="albumTitle" maxlength="24" placeholder="例如：MIDNIGHT DRIVE">
        </label>
        <label class="mini-field">
          <span>风格</span>
          <input id="albumSub" maxlength="12" placeholder="选填，例如：合成器浪潮">
        </label>
        <label class="mini-field">
          <span>封面</span>
          <input id="albumCover" type="file" accept="image/*">
          <span class="cover-hint">不选则使用渐变占位封面</span>
        </label>
        <div class="mini-actions">
          <button type="button" class="mini-btn ghost" data-reset>恢复默认</button>
          <button type="button" class="mini-btn ghost" data-close>取消</button>
          <button type="submit" class="mini-btn primary">添加</button>
        </div>
      </form>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    modal.querySelector('#albumTitle').focus();

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) {
        modal.remove();
        return;
      }
      if (event.target.closest('[data-reset]')) {
        clearAudioFiles();
        localStorage.removeItem(STORE_KEY);
        localStorage.removeItem(`${STORE_KEY}_ver`);
        location.reload();
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const title = modal.querySelector('#albumTitle').value.trim();
      if (!title) {
        modal.querySelector('#albumTitle').focus();
        return;
      }

      const sub = modal.querySelector('#albumSub').value.trim() || '未分类';
      const file = modal.querySelector('#albumCover').files[0];
      const cover = file ? await fileToCover(file).catch(() => null) : null;

      albums.push({
        id: 'a' + Date.now().toString(36),
        title,
        sub,
        year: new Date().getFullYear(),
        accent: ACCENTS[albums.length % ACCENTS.length],
        cover: cover || `images/albums/${(albums.length % 6) + 1}.jpg`,
        ring: ringKey,
        tracks: [],
      });

      if (!saveAlbums()) {
        albums.pop();
        return;
      }

      modal.remove();
      renderRings();
      toast(`已添加专辑《${title}》，点开封面可加歌`);
    });
  }

  async function removeAlbum(index) {
    const album = albums[index];
    if (!album) return;

    if (albums.length <= 1) {
      toast('至少保留一张专辑');
      return;
    }

    const ok = await confirmModal(`删除专辑《${album.title}》？`, '这张专辑和它下面的曲目都会被移除。');
    if (!ok) return;

    const [removed] = albums.splice(index, 1);
    (removed && removed.tracks ? removed.tracks : []).forEach(releaseTrackFile);

    if (current.album === index) resetPlayer();
    else if (current.album > index) current.album -= 1;

    if (activeIndex === index) {
      closeView();
    } else if (activeIndex > index) {
      activeIndex -= 1;
    }

    saveAlbums();
    renderRings();
    toast('已删除专辑');
  }

  /* ---------------- 专辑详情 ---------------- */
  function openView(index, cardEl) {
    const album = albums[index];
    if (!album) return;

    activeIndex = index;
    viewOpen = true;
    lastFocus = cardEl;
    syncPause();

    document.documentElement.style.setProperty('--accent', album.accent || DEFAULT_ACCENT);
    viewBg.style.backgroundImage = `url("${album.cover}")`;
    viewTitle.textContent = album.title;
    updateViewSub(index);

    renderTracks(index);

    clearTimeout(closeTimer);
    view.hidden = false;
    view.setAttribute('aria-hidden', 'false');
    void view.offsetWidth; // 强制回流，保证淡入过渡生效（不依赖 rAF）
    view.classList.add('is-open');
    expandFromCard(cardEl);

    const panel = view.querySelector('.view-panel');
    if (panel) panel.focus({ preventScroll: true });
  }

  function updateViewSub(index) {
    const album = albums[index];
    if (!album) return;
    viewSub.textContent = `${album.sub} · ${album.year} · 共 ${album.tracks.length} 首`;
  }

  /** 正方形详情从被点击的专辑位置展开过去 */
  function expandFromCard(cardEl) {
    const panel = view.querySelector('.view-panel');
    if (!panel) return;
    if (reduceMotion.matches) return; // 系统开启“减少动态效果”时不播动画

    const from = cardEl.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    if (!to.width || !from.width) return;

    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);

    panel.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.25 },
      { transform: 'none', opacity: 1 },
    ], { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' });
  }

  function closeView() {
    if (!viewOpen) return;
    viewOpen = false;
    view.classList.remove('is-open');

    const playing = albums[current.album];
    document.documentElement.style.setProperty(
      '--accent',
      playing ? playing.accent : DEFAULT_ACCENT
    );

    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (viewOpen) return;
      view.hidden = true;
      view.setAttribute('aria-hidden', 'true');
    }, 340);

    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    syncPause();
  }

  view.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closeView();
  });

  /* ---------------- 曲目 ---------------- */
  function renderTracks(albumIndex) {
    const album = albums[albumIndex];
    if (!album) return;

    const rows = album.tracks.map((track, index) => `
      <li class="track-item">
        <button type="button" class="track" data-track="${index}">
          <span class="track-index">${String(index + 1).padStart(2, '0')}</span>
          <span class="track-name">${escapeHtml(track.title)}</span>
          <span class="track-eq" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="track-time">${escapeHtml(track.duration)}</span>
        </button>
        <button type="button" class="track-remove" aria-label="删除歌曲 ${escapeHtml(track.title)}">✕</button>
      </li>`).join('');

    trackList.innerHTML = `
      ${rows || '<li class="track-empty">还没有曲目</li>'}
      <li><button type="button" class="track-add">＋ 添加歌曲</button></li>
    `;

    trackList.querySelectorAll('.track').forEach((btn) => {
      btn.addEventListener('click', () => playTrack(albumIndex, Number(btn.dataset.track)));
    });

    trackList.querySelectorAll('.track-remove').forEach((btn, index) => {
      btn.addEventListener('click', () => removeTrack(albumIndex, index));
    });

    trackList.querySelector('.track-add').addEventListener('click', () => openTrackForm(albumIndex));

    markTracks();
  }

  function openTrackForm(albumIndex, options = {}) {
    const album = albums[albumIndex];
    if (!album) return;

    const replaceIndex = Number.isInteger(options.replaceIndex) ? options.replaceIndex : null;
    const editing = replaceIndex != null ? album.tracks[replaceIndex] : null;

    const modal = document.createElement('div');
    modal.className = 'mini-modal';
    modal.innerHTML = `
      <div class="mini-mask" data-close></div>
      <form class="mini-panel" novalidate>
        <h3>${editing ? '重新选择文件' : '添加歌曲'}</h3>
        <p class="mini-text">${editing ? '原来的文件已失效，重新选一首并覆盖它' : `添加到《${escapeHtml(album.title)}》`}</p>
        <label class="mini-field">
          <span>音频文件</span>
          <input id="trackFile" type="file" accept="audio/*,.mp3,.flac,.m4a,.wav,.ogg,.opus">
          <span class="cover-hint" id="trackFileHint">从电脑里选一首（mp3 / flac / m4a / wav）；不选则用演示音频</span>
        </label>
        <label class="mini-field">
          <span>歌曲名</span>
          <input id="trackTitle" maxlength="40" placeholder="选文件后自动填入" value="${editing ? escapeHtml(editing.title) : ''}">
        </label>
        <label class="mini-field">
          <span>时长</span>
          <input id="trackDuration" maxlength="6" placeholder="自动读取，也可手填 3:45" value="${editing && editing.duration !== '--:--' ? escapeHtml(editing.duration) : ''}">
        </label>
        <div class="mini-actions">
          <button type="button" class="mini-btn ghost" data-close>取消</button>
          <button type="submit" class="mini-btn primary">${editing ? '替换' : '添加'}</button>
        </div>
      </form>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    const fileInput = modal.querySelector('#trackFile');
    const titleInput = modal.querySelector('#trackTitle');
    const durationInput = modal.querySelector('#trackDuration');
    const fileHint = modal.querySelector('#trackFileHint');

    titleInput.focus();
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) modal.remove();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      fileHint.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
      if (!titleInput.value.trim()) titleInput.value = titleFromFileName(file.name);

      const duration = await probeAudioDuration(file);
      if (duration) durationInput.value = duration;
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const file = fileInput.files && fileInput.files[0];
      const title = titleInput.value.trim() || (file ? titleFromFileName(file.name) : '');
      if (!title) {
        titleInput.focus();
        return;
      }

      const track = {
        title,
        duration: durationInput.value.trim() || '--:--',
      };

      if (file) {
        const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        localFiles.set(id, file);
        track.src = 'local:' + id;

        // 能存进 IndexedDB 就存（http/https 下刷新后还能播）
        try {
          await withTimeout(saveAudioFile(id, file), DB_TIMEOUT);
          track.src = 'idb:' + id;
        } catch (err) {
          /* file:// 或浏览器禁用数据库时，仅本次会话可用 */
        }
      }

      if (replaceIndex != null && album.tracks[replaceIndex]) {
        const old = album.tracks[replaceIndex];
        if (String(old.src || '').startsWith('idb:')) deleteAudioFile(String(old.src).slice(4));
        album.tracks[replaceIndex] = track;
      } else {
        album.tracks.push(track);
      }

      saveAlbums();
      modal.remove();
      renderTracks(albumIndex);
      updateViewSub(albumIndex);
      toast(
        file
          ? (track.src.startsWith('idb:') ? '已添加并存入本地' : '已添加（刷新页面后需重新选择文件）')
          : '已添加歌曲'
      );
    });
  }

  /** 从文件名猜歌名：去掉序号和结尾的「 - 歌手」 */
  function titleFromFileName(name) {
    const base = name.replace(/\.[^.]+$/, '');
    return base
      .replace(/^\s*\d{1,3}[\s._-]+/, '')
      .replace(/\s*-\s*[^-]+$/, '')
      .trim() || base;
  }

  /** 读一段音频的时长，读不到就返回空 */
  function probeAudioDuration(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const probe = new Audio();
      let settled = false;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(url);
        resolve(value);
      };

      probe.preload = 'metadata';
      probe.addEventListener('loadedmetadata', () => {
        finish(Number.isFinite(probe.duration) ? formatTime(probe.duration) : '');
      });
      probe.addEventListener('error', () => finish(''));
      setTimeout(() => finish(''), 4000);
      probe.src = url;
    });
  }

  function removeTrack(albumIndex, trackIndex) {
    const album = albums[albumIndex];
    if (!album || !album.tracks[trackIndex]) return;

    const [removed] = album.tracks.splice(trackIndex, 1);
    releaseTrackFile(removed);

    if (current.album === albumIndex) {
      if (current.track === trackIndex) resetPlayer();
      else if (current.track > trackIndex) current.track -= 1;
    }

    saveAlbums();
    renderTracks(albumIndex);
    updateViewSub(albumIndex);
    toast('已删除歌曲');
  }

  /** 删歌/删专辑时顺手清掉存在浏览器里的文件 */
  function releaseTrackFile(track) {
    const src = String((track && track.src) || '');
    if (src.startsWith('idb:')) deleteAudioFile(src.slice(4));
    if (src.startsWith('local:')) localFiles.delete(src.slice(6));
  }

  function markTracks() {
    trackList.querySelectorAll('.track').forEach((btn) => {
      const isCurrent = current.album === activeIndex && Number(btn.dataset.track) === current.track;
      btn.classList.toggle('is-current', isCurrent);
      btn.classList.toggle('is-paused', isCurrent && audio.paused);
    });
  }

  /* ---------------- 播放器 ---------------- */
  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function resetPlayer() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    current.album = -1;
    current.track = -1;
    player.classList.remove('is-on');
    player.hidden = true;
    progressFill.style.width = '0%';
    curTime.textContent = '0:00';
    totalTime.textContent = '0:00';
  }

  async function playTrack(albumIndex, trackIndex) {
    const album = albums[albumIndex];
    const track = album && album.tracks[trackIndex];
    if (!track) return;

    // 本地文件要先取出来转成临时地址；取不到说明文件丢了，引导重新选择
    const source = await resolveTrackSource(track);
    if (!source) {
      toast('这个本地文件需要重新选择（刷新页面或清理浏览器后失效）');
      openTrackForm(albumIndex, { replaceIndex: trackIndex });
      return;
    }

    current.album = albumIndex;
    current.track = trackIndex;

    document.documentElement.style.setProperty('--accent', album.accent || DEFAULT_ACCENT);

    playerCover.src = album.cover;
    playerCover.alt = '';
    playerTitle.textContent = track.title;
    playerSub.textContent = `${album.title} · ${album.sub}`;
    playerTag.classList.toggle('is-on', !track.src);

    if (player.hidden) {
      player.hidden = false;
      void player.offsetWidth; // 强制回流，保证滑入过渡生效
      player.classList.add('is-on');
    }

    audio.src = source;
    audio.currentTime = 0;

    audio.play().catch(() => {
      /* 少数浏览器会拦截自动播放，用户再点一次播放键即可 */
    });

    markTracks();
    updatePlayButton();
  }

  function updatePlayButton() {
    const playing = !audio.paused && !audio.ended;
    playBtn.textContent = playing ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');

    if (activeIndex >= 0) {
      const sameAlbum = current.album === activeIndex;
      playAlbumBtn.textContent = sameAlbum && playing ? '❚❚ 暂停' : '▶ 播放整张';
    }

    markTracks();
  }

  function nextTrack(direction) {
    const album = albums[current.album];
    if (!album || !album.tracks.length) return;
    const next = (current.track + direction + album.tracks.length) % album.tracks.length;
    playTrack(current.album, next);
  }

  playBtn.addEventListener('click', () => {
    const album = albums[activeIndex >= 0 ? activeIndex : 0];
    if (!album || !album.tracks.length) {
      toast('这张专辑还没有歌曲');
      return;
    }
    if (!audio.src) {
      playTrack(activeIndex >= 0 ? activeIndex : 0, 0);
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  prevBtn.addEventListener('click', () => nextTrack(-1));
  nextBtn.addEventListener('click', () => nextTrack(1));

  playAlbumBtn.addEventListener('click', () => {
    if (activeIndex < 0) return;
    const album = albums[activeIndex];
    if (!album.tracks.length) {
      toast('这张专辑还没有歌曲');
      return;
    }

    if (current.album === activeIndex) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    playTrack(activeIndex, 0);
  });

  progress.addEventListener('click', (event) => {
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    const rect = progress.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
  });

  progress.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!Number.isFinite(audio.duration) || !audio.duration) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 5 : -5;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + delta));
  });

  audio.addEventListener('play', updatePlayButton);
  audio.addEventListener('pause', updatePlayButton);
  audio.addEventListener('timeupdate', () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const ratio = duration ? audio.currentTime / duration : 0;
    progressFill.style.width = `${ratio * 100}%`;
    curTime.textContent = formatTime(audio.currentTime);
    totalTime.textContent = duration ? formatTime(duration) : '0:00';
    progress.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  });
  audio.addEventListener('loadedmetadata', () => {
    totalTime.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('ended', () => nextTrack(1));

  /* ---------------- 背景切换 ---------------- */
  const BACKGROUNDS = [
    { name: '午夜星空', css: 'radial-gradient(circle at 50% 35%, #1a1a2e 0%, #0b0b12 70%)' },
    { name: '霓虹紫', css: 'radial-gradient(circle at 68% 18%, #3b0d5c 0%, #0b0413 65%)' },
    { name: '深海', css: 'radial-gradient(circle at 30% 22%, #063a52 0%, #030a10 72%)' },
    { name: '落日', css: 'radial-gradient(circle at 66% 20%, #5a2410 0%, #100604 70%)' },
    { name: '极简黑', css: 'radial-gradient(circle at 50% 30%, #14161c 0%, #050608 75%)' },
  ];

  const layers = [document.getElementById('bgA'), document.getElementById('bgB')];
  const bgSwitch = document.getElementById('bgSwitch');
  const bgFile = document.getElementById('bgFile');
  let layerIndex = 1;

  const dots = BACKGROUNDS.map((bg, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'bg-dot';
    dot.style.background = bg.css;
    dot.title = bg.name;
    dot.setAttribute('aria-label', `背景：${bg.name}`);
    dot.addEventListener('click', () => setPreset(index));
    bgSwitch.appendChild(dot);
    return dot;
  });

  /** 双图层交叉淡入，避免背景切换太生硬 */
  function applyBackground(css) {
    const next = layers[1 - layerIndex];
    next.style.background = css;
    next.classList.add('is-on');
    layers[layerIndex].classList.remove('is-on');
    layerIndex = 1 - layerIndex;
  }

  function setPreset(index, persist = true) {
    const preset = BACKGROUNDS[index];
    if (!preset) return;
    applyBackground(preset.css);
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    if (persist) {
      try { localStorage.setItem('album_bg', String(index)); } catch (err) { /* 忽略 */ }
    }
  }

  function restoreBackground() {
    let saved = 0;
    try {
      const raw = Number(localStorage.getItem('album_bg'));
      if (Number.isInteger(raw) && raw >= 0 && raw < BACKGROUNDS.length) saved = raw;
    } catch (err) { /* 忽略 */ }
    setPreset(saved, false);
  }

  bgFile.addEventListener('change', () => {
    const file = bgFile.files && bgFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      applyBackground(`url("${reader.result}") center / cover no-repeat`);
      dots.forEach((dot) => dot.classList.remove('is-active'));
    });
    reader.readAsDataURL(file);
    bgFile.value = '';
  });

  /* ---------------- 键盘 ---------------- */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && viewOpen) {
      closeView();
      return;
    }

    if (event.key === ' ' && !viewOpen) {
      const tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'button' || tag === 'input' || tag === 'textarea') return;
      event.preventDefault();
      playBtn.click();
    }
  });

  /* ---------------- 斜向图片轮播 ---------------- */
  const BANNERS_KEY = 'album_banners';
  const DEFAULT_BANNERS = [1, 2, 3, 4, 5, 6].map((n) => `images/banners/${n}.jpg`);
  const marqueeTracks = [document.getElementById('marqueeTop'), document.getElementById('marqueeBottom')];

  function loadBanners() {
    try {
      const raw = localStorage.getItem(BANNERS_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length) return list;
      }
    } catch (err) {
      /* 数据损坏就用默认图 */
    }
    return DEFAULT_BANNERS.slice();
  }

  let banners = loadBanners();

  function saveBanners() {
    try {
      localStorage.setItem(BANNERS_KEY, JSON.stringify(banners));
      return true;
    } catch (err) {
      toast('保存失败：本地存储空间可能已满');
      return false;
    }
  }

  function renderMarquees() {
    const count = banners.length;

    marqueeTracks.forEach((track) => {
      if (!track) return;

      if (!count) {
        track.innerHTML = '';
        return;
      }

      const item = (index) => `
        <figure class="marquee-item" data-index="${index}">
          <img src="${banners[index]}" alt="" draggable="false">
          <button class="marquee-remove" type="button" aria-label="移除这张轮播图">✕</button>
        </figure>`;

      // 按可视宽度算需要重复几份，避免循环时露出空白
      const band = track.parentElement;
      const bandWidth = (band && band.clientWidth) || 2000;
      const bandHeight = (band && band.clientHeight) || 220;
      const itemWidth = (bandHeight * 16) / 9 + 16;
      const stripWidth = Math.max(1, count * itemWidth);
      const copies = Math.max(2, Math.ceil(bandWidth / stripWidth) + 1);

      const order = banners.map((_, index) => index);
      const items = [];
      for (let copy = 0; copy < copies; copy += 1) {
        order.forEach((index) => items.push(item(index)));
      }

      track.style.setProperty('--loop', `${(100 / copies).toFixed(4)}%`);
      track.innerHTML = items.join('');
    });
  }

  marqueeTracks.forEach((track) => {
    if (!track) return;
    track.addEventListener('click', (event) => {
      const btn = event.target.closest('.marquee-remove');
      if (!btn) return;

      const figure = btn.closest('.marquee-item');
      const index = Number(figure && figure.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index >= banners.length) return;

      banners.splice(index, 1);
      saveBanners();
      renderMarquees();
      toast('已移除轮播图');
    });
  });

  /** 把图片裁成 16:9、缩到 480×270，尽量少占空间 */
  function fileToBanner(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        const width = 480;
        const height = 270;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const scale = Math.max(width / image.width, height / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;

        canvas.getContext('2d').drawImage(
          image,
          (width - drawW) / 2,
          (height - drawH) / 2,
          drawW,
          drawH
        );

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片读取失败'));
      };
      image.src = url;
    });
  }

  const bannerFile = document.getElementById('bannerFile');
  document.querySelectorAll('.marquee-add').forEach((btn) => {
    btn.addEventListener('click', () => bannerFile.click());
  });

  bannerFile.addEventListener('change', async () => {
    const file = bannerFile.files && bannerFile.files[0];
    if (!file) return;

    const dataUrl = await fileToBanner(file).catch(() => null);
    bannerFile.value = '';
    if (!dataUrl) {
      toast('图片读取失败');
      return;
    }

    banners.push(dataUrl);
    if (!saveBanners()) {
      banners.pop();
      return;
    }
    renderMarquees();
    toast('已添加轮播图（16:9）');
  });

  /* ---------------- 启动 ---------------- */
  fab.addEventListener('click', (event) => {
    const btn = event.target.closest('.fab-btn');
    if (!btn) return;
    openAlbumForm(btn.dataset.ring === 'inner' ? 'inner' : 'outer');
  });
  window.addEventListener('resize', () => {
    Object.values(RINGS).forEach(layoutRing);
  });
  restoreBackground();
  renderRings();
  renderMarquees();
})();



