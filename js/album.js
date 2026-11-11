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
    if (!('indexedDB' in window)) return Promise.reject(new Error('This browser does not support IndexedDB'));
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
      toast('Could not save: local storage is full');
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
      mobileCard: 92,
      mobileRatio: 0.37,
    },
    inner: {
      el: document.getElementById('ringInner'),
      cards: [],
      step: 0,
      offset: 0.5,
      hover: 0,
      anim: null,
      baseRadius: 210,
      maxCard: 152,
      widthRatio: 0.16,
      mobileCard: 68,
      mobileRatio: 0.19,
    },
  };

  /** 每一圈单独算半径和封面尺寸，保证这一圈自己不会重叠 */
  function layoutRing(ring) {
    const count = ring.cards.length;
    if (!count) return;

    const stageW = stage.clientWidth || window.innerWidth;
    // 手机上整体缩小并换成更紧凑的比例，避免两圈超出窄屏
    const mobile = stageW < 760;
    const cardMax = mobile ? ring.mobileCard : ring.maxCard;
    const radiusMax = Math.min(
      ring.baseRadius * (mobile ? 0.82 : 1),
      stageW * (mobile ? ring.mobileRatio : ring.widthRatio)
    );

    let radius = (count * (cardMax + GAP)) / (2 * Math.PI);
    radius = Math.min(radiusMax, Math.max(radius, radiusMax * 0.88));

    // 半径被压住时按弧长缩小封面
    const arc = (2 * Math.PI * radius) / count;
    const card = Math.min(cardMax, Math.max(36, arc - GAP));

    ring.el.style.setProperty('--card', `${card.toFixed(1)}px`);
    ring.el.style.setProperty('--radius', `${radius.toFixed(1)}px`);
  }

  function buildCard(album, index, ring) {
    const card = document.createElement('div');
    card.className = 'album';
    card.dataset.index = String(index);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${album.title}, ${album.sub}, view tracks`);
    card.innerHTML = `
      <span class="album-inner">
        <img src="${album.cover}" alt="" draggable="false">
        <span class="album-meta">
          <strong>${escapeHtml(album.title)}</strong>
          <em>${escapeHtml(album.sub)}</em>
        </span>
      </span>
      <button class="album-remove" type="button" aria-label="Delete album ${escapeHtml(album.title)}">✕</button>
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

  /**
   * 读这一圈「实际转到多少度」。
   *
   * 不再从动画时长/方向推算 —— 那样内外圈方向不同就容易算反。
   * 这里直接解析渲染后的 3D 矩阵：环的 transform 是
   * translateY · rotateX(-8deg) · rotateY(θ)，其第一列第三行
   * m31 = -cos(8°)·sin(θ)，配合 m11 = cos(θ) 反解出 θ。
   * 读到的是浏览器真正在用的角度，内外圈都适用。
   */
  function ringRotation(ring) {
    const raw = getComputedStyle(ring.el).transform;
    if (!raw || raw === 'none') return 0;
    const matrix = new DOMMatrixReadOnly(raw);
    return (Math.atan2(matrix.m31, matrix.m11) * 180) / Math.PI;
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
            <button type="button" class="mini-btn ghost" data-close>Cancel</button>
            <button type="button" class="mini-btn danger" data-ok>Delete</button>
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
        reject(new Error('Could not read the image'));
      };
      image.src = url;
    });
  }

  /* ---------------- 导出 / 导入数据 ---------------- */
  /** 把当前设置（专辑、轮播图、背景）导出成 JSON；浏览器里的本地音频不包含 */
  function exportData() {
    const exportAlbums = albums.map((album) => ({
      ...album,
      tracks: album.tracks.map((track) => {
        const src = String(track.src || '');
        if (!src || /^(idb|local|blob):/.test(src)) {
          const copy = { ...track };
          delete copy.src; // 只存在这台浏览器里的音频，导出去也放不了
          return copy;
        }
        return { ...track };
      }),
    }));

    let bgImage = null;
    let bgPreset = 0;
    try {
      bgImage = localStorage.getItem('album_bg_image');
      const raw = Number(localStorage.getItem('album_bg'));
      if (Number.isInteger(raw) && raw >= 0) bgPreset = raw;
    } catch (err) { /* 忽略 */ }

    const payload = {
      app: 'album-ring',
      version: 1,
      exportedAt: new Date().toISOString(),
      albums: exportAlbums,
      banners,
      bgPreset,
      bgImage,
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `album-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Exported JSON (local audio files are not included)');
  }

  /** 读入导出的 JSON，覆盖当前设置并刷新 */
  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.albums) || !data.albums.length) throw new Error('missing albums');

        localStorage.setItem(STORE_KEY, JSON.stringify(data.albums));
        // 避免数据文件版本号不一致，把刚导入的内容清掉
        if (window.ALBUMS_VERSION) {
          localStorage.setItem(`${STORE_KEY}_ver`, window.ALBUMS_VERSION);
        } else {
          localStorage.removeItem(`${STORE_KEY}_ver`);
        }

        if (Array.isArray(data.banners)) {
          localStorage.setItem(BANNERS_KEY, JSON.stringify(data.banners));
        }
        if (Number.isInteger(data.bgPreset)) {
          localStorage.setItem('album_bg', String(data.bgPreset));
        }
        if (data.bgImage) {
          localStorage.setItem('album_bg_image', data.bgImage);
        } else {
          localStorage.removeItem('album_bg_image');
        }

        toast('Imported — reloading…');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        toast('Import failed: invalid file');
      }
    });

    input.click();
  }

  /* ---------------- 新增 / 删除专辑 ---------------- */
  function openAlbumForm(ringKey = 'outer') {
    const ringName = ringKey === 'inner' ? 'Inner ring' : 'Outer ring';

    const modal = document.createElement('div');
    modal.className = 'mini-modal';
    modal.innerHTML = `
      <div class="mini-mask" data-close></div>
      <form class="mini-panel" novalidate>
        <h3>New album · ${ringName}</h3>
        <label class="mini-field">
          <span>Album title</span>
          <input id="albumTitle" maxlength="24" placeholder="e.g. MIDNIGHT DRIVE">
        </label>
        <label class="mini-field">
          <span>Genre</span>
          <input id="albumSub" maxlength="12" placeholder="Optional, e.g. Synthwave">
        </label>
        <label class="mini-field">
          <span>Cover</span>
          <input id="albumCover" type="file" accept="image/*">
          <span class="cover-hint">Leave empty to use a gradient placeholder</span>
        </label>
        <div class="mini-actions">
          <span class="mini-links">
            <button type="button" class="mini-link" data-export>Export</button>
            <button type="button" class="mini-link" data-import>Import</button>
            <button type="button" class="mini-link" data-reset>Reset</button>
          </span>
          <button type="button" class="mini-btn ghost" data-close>Cancel</button>
          <button type="submit" class="mini-btn primary">Add</button>
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
      if (event.target.closest('[data-export]')) {
        exportData();
        return;
      }
      if (event.target.closest('[data-import]')) {
        importData();
        return;
      }
      if (event.target.closest('[data-reset]')) {
        clearAudioFiles();
        localStorage.removeItem(STORE_KEY);
        localStorage.removeItem(`${STORE_KEY}_ver`);
        localStorage.removeItem('album_bg_image');
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

      const sub = modal.querySelector('#albumSub').value.trim() || 'Uncategorized';
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
      toast(`Added "${title}" — open it to add tracks`);
    });
  }

  async function removeAlbum(index) {
    const album = albums[index];
    if (!album) return;

    if (albums.length <= 1) {
      toast('Keep at least one album');
      return;
    }

    const ok = await confirmModal(`Delete the album "${album.title}"?`, 'The album and all of its tracks will be removed.');
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
    toast('Album deleted');
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
    viewSub.textContent = `${album.sub} · ${album.year} · ${album.tracks.length} tracks`;
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
        <button type="button" class="track-remove" aria-label="Delete track ${escapeHtml(track.title)}">✕</button>
      </li>`).join('');

    trackList.innerHTML = `
      ${rows || '<li class="track-empty">No tracks yet</li>'}
      <li><button type="button" class="track-add">+ Add track</button></li>
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
        <h3>${editing ? 'Choose the file again' : 'Add a track'}</h3>
        <p class="mini-text">${editing ? 'The original file is gone — pick it again to replace it' : `Add to "${escapeHtml(album.title)}"`}</p>
        <label class="mini-field">
          <span>Audio file</span>
          <input id="trackFile" type="file" accept="audio/*,.mp3,.flac,.m4a,.wav,.ogg,.opus">
          <span class="cover-hint" id="trackFileHint">Pick a file from your computer (mp3 / flac / m4a / wav); without one a demo tone is used</span>
        </label>
        <label class="mini-field">
          <span>Track title</span>
          <input id="trackTitle" maxlength="40" placeholder="Filled in from the file" value="${editing ? escapeHtml(editing.title) : ''}">
        </label>
        <label class="mini-field">
          <span>Duration</span>
          <input id="trackDuration" maxlength="6" placeholder="Read automatically, or type 3:45" value="${editing && editing.duration !== '--:--' ? escapeHtml(editing.duration) : ''}">
        </label>
        <div class="mini-actions">
          <button type="button" class="mini-btn ghost" data-close>Cancel</button>
          <button type="submit" class="mini-btn primary">${editing ? 'Replace' : 'Add'}</button>
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
          ? (track.src.startsWith('idb:') ? 'Added and saved in this browser' : 'Added (pick the file again after a reload)')
          : 'Track added'
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
    toast('Track deleted');
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
      toast('This local file must be picked again (it is lost after a reload or clearing browser data)');
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
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');

    if (activeIndex >= 0) {
      const sameAlbum = current.album === activeIndex;
      playAlbumBtn.textContent = sameAlbum && playing ? '❚❚ Pause' : '▶ Play album';
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
      toast('This album has no tracks yet');
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
      toast('This album has no tracks yet');
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
    { name: 'Midnight', css: 'radial-gradient(circle at 50% 35%, #1a1a2e 0%, #0b0b12 70%)' },
    { name: 'Neon Purple', css: 'radial-gradient(circle at 68% 18%, #3b0d5c 0%, #0b0413 65%)' },
    { name: 'Deep Sea', css: 'radial-gradient(circle at 30% 22%, #063a52 0%, #030a10 72%)' },
    { name: 'Sunset', css: 'radial-gradient(circle at 66% 20%, #5a2410 0%, #100604 70%)' },
    { name: 'Minimal Black', css: 'radial-gradient(circle at 50% 30%, #14161c 0%, #050608 75%)' },
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
    dot.setAttribute('aria-label', `Background: ${bg.name}`);
    dot.addEventListener('click', () => setPreset(index));
    bgSwitch.appendChild(dot);
    return dot;
  });

  /** 双图层交叉淡入，避免背景切换太生硬 */
  function applyBackground(css) {
    const next = layers[1 - layerIndex];
    next.style.background = css;
    // 照片背景额外压一层暗色，纯渐变不需要
    next.classList.toggle('is-photo', /url\(/i.test(css));
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
      try {
        localStorage.setItem('album_bg', String(index));
        localStorage.removeItem('album_bg_image');
      } catch (err) { /* 忽略 */ }
    }
  }

  function restoreBackground() {
    // 优先恢复用户自己选过 / 上传过的背景
    try {
      const custom = localStorage.getItem('album_bg_image');
      if (custom) {
        applyBackground(custom);
        dots.forEach((dot) => dot.classList.remove('is-active'));
        return;
      }
    } catch (err) { /* 忽略 */ }

    let saved = null;
    try {
      const raw = localStorage.getItem('album_bg');
      if (raw !== null) {
        const value = Number(raw);
        if (Number.isInteger(value) && value >= 0 && value < BACKGROUNDS.length) saved = value;
      }
    } catch (err) { /* 忽略 */ }

    // 本地没选过就用数据文件里的默认背景
    if (saved === null) {
      if (window.DEFAULT_BG_IMAGE) {
        applyBackground(window.DEFAULT_BG_IMAGE);
        return;
      }
      saved = Number.isInteger(window.DEFAULT_BG) ? window.DEFAULT_BG : 0;
    }

    setPreset(saved, false);
  }

  bgFile.addEventListener('change', () => {
    const file = bgFile.files && bgFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const css = `url("${reader.result}") center / cover no-repeat`;
      applyBackground(css);
      dots.forEach((dot) => dot.classList.remove('is-active'));
      try { localStorage.setItem('album_bg_image', css); } catch (err) { /* 容量不足就算了 */ }
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

    // 数据文件里带有默认轮播图就用它（由 tools/apply-export.mjs 生成）
    if (Array.isArray(window.DEFAULT_BANNERS) && window.DEFAULT_BANNERS.length) {
      return window.DEFAULT_BANNERS.slice();
    }
    return DEFAULT_BANNERS.slice();
  }

  let banners = loadBanners();

  function saveBanners() {
    try {
      localStorage.setItem(BANNERS_KEY, JSON.stringify(banners));
      return true;
    } catch (err) {
      toast('Could not save: local storage is full');
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
          <button class="marquee-remove" type="button" aria-label="Remove this banner">✕</button>
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

      track.innerHTML = items.join('');

      // 位移量用「一份内容的真实像素宽度」，这样循环点严丝合缝，不会跳
      const first = track.querySelector('.marquee-item');
      if (first) {
        const itemW = first.offsetWidth;
        const margin = parseFloat(getComputedStyle(first).marginRight) || 0;
        const period = count * (itemW + margin);
        track.style.setProperty('--loop', `${period.toFixed(2)}px`);
      }
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
      toast('Banner removed');
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
        reject(new Error('Could not read the image'));
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
      toast('Could not read the image');
      return;
    }

    banners.push(dataUrl);
    if (!saveBanners()) {
      banners.pop();
      return;
    }
    renderMarquees();
    toast('Banner added (16:9)');
  });

  /* ---------------- 启动 ---------------- */
  fab.addEventListener('click', (event) => {
    const btn = event.target.closest('.fab-btn');
    if (btn) {
      openAlbumForm(btn.dataset.ring === 'inner' ? 'inner' : 'outer');
      fab.classList.remove('is-open');
      return;
    }
    // 触屏没有 hover：点一下展开 / 收起
    fab.classList.toggle('is-open');
  });

  document.addEventListener('click', (event) => {
    if (!fab.contains(event.target)) fab.classList.remove('is-open');
  });

  window.addEventListener('resize', () => {
    Object.values(RINGS).forEach(layoutRing);
  });
  restoreBackground();
  renderRings();
  renderMarquees();
})();






