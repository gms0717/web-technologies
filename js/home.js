/* =========================================================
   home.js — 首页
   轮播 / 分类筛选 / 商品网格 / 搜索
   ========================================================= */
(function () {
  'use strict';

  const { money, esc } = JD;

  let activeCat = 'all';
  let keyword = '';
  let visible = 8;

  /* ---------------- 轮播 ---------------- */
  function initCarousel() {
    const track = document.getElementById('carouselTrack');
    const dotsBox = document.getElementById('carouselDots');
    const box = document.getElementById('carousel');
    if (!track || !dotsBox || !box) return;

    track.innerHTML = JD.banners.map((b) => `
      <div class="slide" style="background:${b.theme}">
        <span class="slide-tag">${esc(b.tag)}</span>
        <h2>${esc(b.title)}</h2>
        <p>${esc(b.sub)}</p>
        <a class="slide-cta" href="#goods">${esc(b.cta)} ›</a>
      </div>`).join('');

    dotsBox.innerHTML = JD.banners.map((_, i) =>
      `<button type="button" data-index="${i}" aria-label="第 ${i + 1} 张海报"></button>`).join('');

    const total = JD.banners.length;
    let index = 0;
    let timer = null;

    const go = (next) => {
      index = (next + total) % total;
      track.style.transform = `translateX(-${index * 100}%)`;
      dotsBox.querySelectorAll('button').forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    };
    const play = () => {
      clearInterval(timer);
      timer = setInterval(() => go(index + 1), 5000);
    };

    dotsBox.addEventListener('click', (event) => {
      const dot = event.target.closest('button[data-index]');
      if (!dot) return;
      go(Number(dot.dataset.index));
      play();
    });
    box.addEventListener('mouseenter', () => clearInterval(timer));
    box.addEventListener('mouseleave', play);

    go(0);
    play();
  }

  /* ---------------- 分类入口 ---------------- */
  function renderCats() {
    const host = document.getElementById('catRow');
    if (!host) return;

    host.innerHTML = JD.categories.map((cat) => `
      <button type="button" class="cat-item${activeCat === cat.id ? ' is-active' : ''}" data-cat="${cat.id}">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-name">${esc(cat.name)}</span>
      </button>`).join('');

    host.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCat = activeCat === btn.dataset.cat ? 'all' : btn.dataset.cat;
        visible = 8;
        renderCats();
        renderGoods();
      });
    });
  }

  /* ---------------- 商品网格 ---------------- */
  function currentList() {
    const kw = keyword.trim().toLowerCase();
    return JD.products.filter((product) => {
      const catOk = activeCat === 'all' || product.cat === activeCat;
      const kwOk = !kw || `${product.name}${product.desc}`.toLowerCase().includes(kw);
      return catOk && kwOk;
    });
  }

  function card(product) {
    return `
      <article class="goods-card" data-product="${product.id}" tabindex="0" role="button"
               aria-label="查看商品 ${esc(product.name)}">
        <div class="goods-thumb">
          <img src="${product.img}" alt="${esc(product.name)}" width="400" height="400" loading="lazy">
          ${product.tag ? `<span class="tag">${esc(product.tag)}</span>` : ''}
        </div>
        <p class="goods-name">${esc(product.name)}</p>
        <div class="goods-meta">
          <span class="price"><span class="yen">¥</span>${money(product.price)}<del class="origin">¥${money(product.origin)}</del></span>
          <span class="goods-sales">${esc(product.sales)} 人付款</span>
        </div>
      </article>`;
  }

  function renderGoods() {
    const grid = document.getElementById('goodsGrid');
    const hint = document.getElementById('goodsHint');
    const clear = document.getElementById('clearFilter');
    const moreBox = document.getElementById('loadMoreBox');
    const moreBtn = document.getElementById('loadMore');
    if (!grid) return;

    const list = currentList();
    const shown = list.slice(0, visible);

    grid.innerHTML = shown.length
      ? shown.map(card).join('')
      : `<div class="empty" style="grid-column:1/-1">
           <div class="empty-icon">🔍</div>
           <p>没有找到相关商品，换个关键词试试</p>
         </div>`;

    if (moreBox && moreBtn) {
      moreBox.hidden = list.length <= visible;
      moreBtn.textContent = `查看更多商品（还有 ${list.length - visible} 件）`;
    }

    if (hint) {
      const name = activeCat === 'all' ? '全部商品' : JD.categoryName(activeCat);
      hint.textContent = `${name} · 共 ${list.length} 件`;
    }
    if (clear) {
      clear.hidden = activeCat === 'all' && !keyword;
      clear.onclick = () => {
        activeCat = 'all';
        keyword = '';
        visible = 8;
        renderCats();
        renderGoods();
      };
    }
  }

  function bindGoods() {
    const grid = document.getElementById('goodsGrid');
    if (!grid) return;

    grid.addEventListener('click', (event) => {
      const hit = event.target.closest('[data-product]');
      if (hit) JD.openDetail(hit.dataset.product);
    });
    grid.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const hit = event.target.closest('[data-product]');
      if (hit) {
        event.preventDefault();
        JD.openDetail(hit.dataset.product);
      }
    });
  }

  /* ---------------- 初始化 ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
      keyword = q;
      const input = document.getElementById('searchInput');
      if (input) input.value = q;
    }

    initCarousel();
    renderCats();
    renderGoods();
    bindGoods();

    const moreBtn = document.getElementById('loadMore');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        visible += 8;
        renderGoods();
      });
    }

    // 供头部搜索框调用
    JD.onSearch = (value) => {
      keyword = value;
      activeCat = 'all';
      visible = 8;
      renderCats();
      renderGoods();
      const grid = document.getElementById('goodsGrid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
})();
