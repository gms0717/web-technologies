/* =========================================================
   album.js — 环绕专辑交互
   环形旋转 / 悬停暂停并翻开 / 增删专辑与曲目 / 播放器 / 背景切换
   ========================================================= */
(function () {
  'use strict';

  const PLACEHOLDER = window.PLACEHOLDER_AUDIO || 'audio/placeholder.wav';
  const DEFAULT_ACCENT = '#ff4fa3';
  const SPEED = 7; // 每秒旋转角度
  const SPIN_MS = (360 / SPEED) * 1000; // 转一圈所需毫秒数
  const CARD = 210; // 封面边长（与 css 里 --card 保持一致）
  const GAP = 44; // 相邻封面之间至少留出的弧长
  const STORE_KEY = 'album_data';
  const ACCENTS = ['#ff4fa3', '#38e1ff', '#ffb454', '#a3e635', '#9db4ff', '#c084fc'];

  const ring = document.getElementById('ring');
  const stage = document.querySelector('.stage');
  const addAlbumBtn = document.getElementById('addAlbum');

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

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const cards = [];
  let albums = loadAlbums();
  let step = 0;
  let angleOffset = 0;
  let hoverCount = 0;
  let viewOpen = false;
  let activeIndex = -1;
  let lastFocus = null;
  let closeTimer = null;
  let spinAnim = null;
  const current = { album: -1, track: -1 };

  const escapeHtml = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));

  /* ---------------- 数据存取 ---------------- */
  function loadAlbums() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (err) {
      /* 数据损坏时回落到默认专辑 */
    }

    return (window.ALBUMS || []).map((album) => ({
      ...album,
      tracks: album.tracks.map((track) => ({ ...track })),
    }));
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

  /* ---------------- 环形专辑 ---------------- */
  /**
   * 专辑变多时：先加大半径，半径到顶后再按需缩小封面，
   * 保证每张占到的弧长 ≥ 封面宽 + 间隙，永远不会叠在一起。
   */
  function layoutRing() {
    const count = Math.max(1, albums.length);
    const stageW = stage.clientWidth || window.innerWidth;
    const radiusMax = Math.min(620, stageW * 0.42);

    // 半径封顶时，每张专辑能分到的弧长
    const arc = (2 * Math.PI * radiusMax) / count;
    const card = Math.min(CARD, Math.max(40, arc - GAP));
    const radius = Math.max(380, (count * (card + GAP)) / (2 * Math.PI));

    ring.style.setProperty('--card', `${card.toFixed(1)}px`);
    ring.style.setProperty('--radius', `${radius.toFixed(1)}px`);
  }

  function renderRing() {
    ring.innerHTML = '';
    cards.length = 0;
    step = albums.length ? 360 / albums.length : 0;
    // 偶数张时让两张分列正前方，构图左右对称
    angleOffset = 0;

    albums.forEach((album, index) => {
      const card = document.createElement('div');
      card.className = 'album';
      card.dataset.index = String(index);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.style.setProperty('--angle', `${index * step + angleOffset}deg`);
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

      // 悬停停止旋转（计数避免在专辑之间移动时闪跳）；背面的专辑不参与
      card.addEventListener('mouseenter', () => {
        if (card.classList.contains('is-back')) return;
        hoverCount += 1;
        syncPause();
      });
      card.addEventListener('mouseleave', () => {
        hoverCount = Math.max(0, hoverCount - 1);
        syncPause();
      });

      card.addEventListener('click', (event) => {
        if (event.target.closest('.album-remove')) return;
        if (card.classList.contains('is-back')) return; // 背面的专辑不响应点击
        openView(index, card);
      });
      card.addEventListener('keydown', (event) => {
        if (event.target !== card) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (card.classList.contains('is-back')) return;
        event.preventDefault();
        openView(index, card);
      });

      card.querySelector('.album-remove').addEventListener('click', (event) => {
        event.stopPropagation();
        removeAlbum(index);
      });

      ring.appendChild(card);
      cards[index] = card;
    });

    updateFacing();
    layoutRing(); // 卡片都放上去之后再按实际尺寸收敛
  }

  /** 读取环形 CSS 动画当前转到的角度（暂停时也会冻结在当前位置） */
  function currentRotation() {
    // 缓存动画对象，避免每 90ms 都新建一次数组
    if (!spinAnim || spinAnim.playState === 'idle') {
      spinAnim = ring.getAnimations()[0] || null;
    }
    const time = spinAnim && spinAnim.currentTime ? Number(spinAnim.currentTime) : 0;
    return (((time % SPIN_MS) / SPIN_MS) * 360) % 360;
  }

  /** 判断每张是否转到背面：背面压暗、隐藏文字、不响应鼠标 */
  function updateFacing() {
    const rot = currentRotation();

    cards.forEach((card, index) => {
      const world = ((rot + index * step + angleOffset) * Math.PI) / 180;
      const isBack = Math.cos(world) < -0.05;
      if (card.classList.contains('is-back') !== isBack) {
        card.classList.toggle('is-back', isBack);
      }
    });
  }

  /** 悬停或看着详情时暂停旋转（只切换 animation-play-state，不打断动画） */
  function syncPause() {
    ring.classList.toggle('is-paused', hoverCount > 0 || viewOpen);
  }

  setInterval(updateFacing, 90);
  updateFacing();

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
  function openAlbumForm() {
    const modal = document.createElement('div');
    modal.className = 'mini-modal';
    modal.innerHTML = `
      <div class="mini-mask" data-close></div>
      <form class="mini-panel" novalidate>
        <h3>新增专辑</h3>
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
        localStorage.removeItem(STORE_KEY);
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
        cover: cover || `images/albums/${(albums.length % 6) + 1}.svg`,
        tracks: [],
      });

      if (!saveAlbums()) {
        albums.pop();
        return;
      }

      modal.remove();
      renderRing();
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

    albums.splice(index, 1);

    if (current.album === index) resetPlayer();
    else if (current.album > index) current.album -= 1;

    if (activeIndex === index) {
      closeView();
    } else if (activeIndex > index) {
      activeIndex -= 1;
    }

    saveAlbums();
    renderRing();
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

  function openTrackForm(albumIndex) {
    const album = albums[albumIndex];
    if (!album) return;

    const modal = document.createElement('div');
    modal.className = 'mini-modal';
    modal.innerHTML = `
      <div class="mini-mask" data-close></div>
      <form class="mini-panel" novalidate>
        <h3>添加歌曲</h3>
        <p class="mini-text">添加到《${escapeHtml(album.title)}》</p>
        <label class="mini-field">
          <span>歌曲名</span>
          <input id="trackTitle" maxlength="40" placeholder="例如：Blue Lantern">
        </label>
        <label class="mini-field">
          <span>时长</span>
          <input id="trackDuration" maxlength="6" placeholder="选填，例如 3:45">
        </label>
        <div class="mini-actions">
          <button type="button" class="mini-btn ghost" data-close>取消</button>
          <button type="submit" class="mini-btn primary">添加</button>
        </div>
      </form>
    `;
    document.body.appendChild(modal);

    const form = modal.querySelector('form');
    modal.querySelector('#trackTitle').focus();
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) modal.remove();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const title = modal.querySelector('#trackTitle').value.trim();
      if (!title) {
        modal.querySelector('#trackTitle').focus();
        return;
      }

      const duration = modal.querySelector('#trackDuration').value.trim() || '--:--';
      album.tracks.push({ title, duration });

      saveAlbums();
      modal.remove();
      renderTracks(albumIndex);
      updateViewSub(albumIndex);
      toast('已添加歌曲');
    });
  }

  function removeTrack(albumIndex, trackIndex) {
    const album = albums[albumIndex];
    if (!album || !album.tracks[trackIndex]) return;

    album.tracks.splice(trackIndex, 1);

    if (current.album === albumIndex) {
      if (current.track === trackIndex) resetPlayer();
      else if (current.track > trackIndex) current.track -= 1;
    }

    saveAlbums();
    renderTracks(albumIndex);
    updateViewSub(albumIndex);
    toast('已删除歌曲');
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
    current.album = -1;
    current.track = -1;
    player.classList.remove('is-on');
    player.hidden = true;
    progressFill.style.width = '0%';
    curTime.textContent = '0:00';
    totalTime.textContent = '0:00';
  }

  function playTrack(albumIndex, trackIndex) {
    const album = albums[albumIndex];
    const track = album && album.tracks[trackIndex];
    if (!track) return;

    current.album = albumIndex;
    current.track = trackIndex;

    document.documentElement.style.setProperty('--accent', album.accent || DEFAULT_ACCENT);

    audio.src = track.src || PLACEHOLDER;
    audio.currentTime = 0;

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

  /* ---------------- 启动 ---------------- */
  addAlbumBtn.addEventListener('click', openAlbumForm);
  window.addEventListener('resize', layoutRing);
  restoreBackground();
  renderRing();
})();

