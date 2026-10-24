/* =========================================================
   common.js — 全站公共逻辑
   本地存储 / 用户 / 订单 / 消息 / 头部 / 页脚 / 提示 / 商品详情弹层
   依赖：data.js
   ========================================================= */
window.JD = window.JD || {};

(function () {
  'use strict';

  const KEYS = {
    user: 'yx_user',
    orders: 'yx_orders',
    messages: 'yx_messages',
    fav: 'yx_fav',
    seeded: 'yx_seeded',
  };

  /* ---------------- 本地存储 ---------------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* 无痕模式等场景静默失败，不影响浏览 */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        /* 忽略 */
      }
    },
  };

  /* ---------------- 工具 ---------------- */
  const money = (value) => {
    const num = Number(value) || 0;
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
  };

  const esc = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));

  const pad2 = (n) => String(n).padStart(2, '0');

  const stamp = (date = new Date()) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

  const currentPage = () => (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  const pageKey = () => ({ index: 'home', orders: 'orders', messages: 'messages', profile: 'profile' }[currentPage()] || '');

  /* ---------------- 用户 ---------------- */
  const DEFAULT_USER = { name: '林小优', level: '黄金会员', points: 1280, coupons: 3, redPacket: 2 };

  const user = {
    get() {
      return store.get(KEYS.user, DEFAULT_USER) || DEFAULT_USER;
    },
    set(patch) {
      const next = { ...user.get(), ...patch };
      store.set(KEYS.user, next);
      return next;
    },
    reset() {
      store.set(KEYS.user, DEFAULT_USER);
      return DEFAULT_USER;
    },
  };

  /* ---------------- 订单 ---------------- */
  const STATUS_TEXT = {
    unpaid: '待付款',
    paid: '待发货',
    shipped: '待收货',
    done: '已完成',
    cancelled: '已取消',
  };

  const round2 = (n) => Math.round(n * 100) / 100;

  const orders = {
    all() {
      const list = store.get(KEYS.orders, []);
      return Array.isArray(list) ? list : [];
    },
    save(list) {
      store.set(KEYS.orders, list);
    },
    /** 用商品 + 规格 + 数量生成一条“待付款”订单 */
    create(items) {
      const snapshot = items.map(({ productId, spec = '', qty = 1, price }) => {
        const product = JD.getProduct(productId);
        if (!product) return null;
        return {
          productId,
          name: product.name,
          img: product.img,
          spec,
          price: price == null ? product.price : price,
          qty,
        };
      }).filter(Boolean);

      if (!snapshot.length) return null;

      const now = new Date();
      const order = {
        id: 'o' + now.getTime().toString(36),
        no: 'YX' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) +
          pad2(now.getHours()) + pad2(now.getMinutes()) + pad2(now.getSeconds()),
        time: stamp(now),
        status: 'unpaid',
        items: snapshot,
        total: round2(snapshot.reduce((sum, it) => sum + it.price * it.qty, 0)),
      };

      orders.save([order, ...orders.all()]);
      return order;
    },
    update(id, patch) {
      const list = orders.all();
      const hit = list.find((o) => o.id === id);
      if (!hit) return null;
      Object.assign(hit, patch);
      orders.save(list);
      return hit;
    },
    remove(id) {
      orders.save(orders.all().filter((o) => o.id !== id));
    },
    byStatus(status) {
      return status && status !== 'all' ? orders.all().filter((o) => o.status === status) : orders.all();
    },
    /** 各状态数量，用于“我的”页统计 */
    counts() {
      return orders.all().reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});
    },
  };

  /* ---------------- 消息 ---------------- */
  const messages = {
    all() {
      const list = store.get(KEYS.messages, []);
      return Array.isArray(list) ? list : [];
    },
    save(list) {
      store.set(KEYS.messages, list);
    },
    unreadCount() {
      return messages.all().filter((m) => !m.read).length;
    },
    markRead(id) {
      const list = messages.all();
      const hit = list.find((m) => m.id === id);
      if (hit && !hit.read) {
        hit.read = true;
        messages.save(list);
        updateBadges();
      }
    },
    markAllRead() {
      messages.save(messages.all().map((m) => ({ ...m, read: true })));
      updateBadges();
    },
  };

  /* ---------------- 收藏 ---------------- */
  const fav = {
    all() {
      const list = store.get(KEYS.fav, []);
      return Array.isArray(list) ? list : [];
    },
    has(id) {
      return fav.all().includes(id);
    },
    toggle(id) {
      const list = fav.all();
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      store.set(KEYS.fav, next);
      return next.includes(id);
    },
  };

  /* ---------------- 初始化演示数据 ---------------- */
  function seed() {
    if (store.get(KEYS.seeded, false)) return;

    store.set(KEYS.user, DEFAULT_USER);
    store.set(KEYS.messages, JD.seedMessages());
    store.set(KEYS.fav, []);

    const snapshot = (items) => items.map(({ productId, spec, qty }) => {
      const product = JD.getProduct(productId);
      return { productId, name: product.name, img: product.img, spec, price: product.price, qty };
    });

    const demo = JD.seedOrders().map((order) => {
      const items = snapshot(order.items);
      return {
        ...order,
        items,
        total: round2(items.reduce((sum, it) => sum + it.price * it.qty, 0)),
      };
    });

    store.set(KEYS.orders, demo);
    store.set(KEYS.seeded, true);
  }

  /* ---------------- 轻提示 ---------------- */
  let toastTimer = null;
  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
    requestAnimationFrame(() => el.classList.add('is-show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2200);
  }

  /* ---------------- 头部 / 页脚 ---------------- */
  function renderHeader() {
    const host = document.getElementById('app-header');
    if (!host) return;

    const me = user.get();
    const active = pageKey();
    const unread = messages.unreadCount();
    const nav = [
      ['index.html', '首页', 'home'],
      ['orders.html', '订单', 'orders'],
      ['messages.html', '消息', 'messages'],
      ['profile.html', '我的', 'profile'],
    ];

    host.className = 'app-header';
    host.innerHTML = `
      <div class="container header-main">
        <a class="brand" href="index.html">
          <span class="brand-mark">优</span>
          <span class="brand-text">
            <strong>${JD.brand.name}</strong>
            <small>${JD.brand.slogan}</small>
          </span>
        </a>

        <nav class="main-nav" aria-label="主导航">
          ${nav.map(([href, label, key]) => `
            <a href="${href}" class="${active === key ? 'is-active' : ''}">${label}${
              key === 'messages' && unread ? `<span class="badge" id="msgBadge">${unread}</span>` : ''
            }</a>`).join('')}
        </nav>

        <form class="search" id="searchForm" role="search">
          <input id="searchInput" type="search" placeholder="搜索商品，如：耳机" aria-label="搜索商品" autocomplete="off">
          <button type="submit">搜索</button>
        </form>

        <a class="user-entry" href="profile.html">
          <span class="avatar">${esc(me.name.slice(0, 1))}</span>
          <span class="user-name">${esc(me.name)}</span>
        </a>
      </div>
    `;

    const form = host.querySelector('#searchForm');
    form.addEventListener('submit', (event) => {
      const keyword = form.querySelector('#searchInput').value.trim();
      event.preventDefault();
      if (typeof JD.onSearch === 'function') {
        JD.onSearch(keyword);
      } else {
        location.href = keyword ? `index.html?q=${encodeURIComponent(keyword)}` : 'index.html';
      }
    });
  }

  function renderFooter() {
    const host = document.getElementById('app-footer');
    if (!host) return;

    host.className = 'app-footer';
    host.innerHTML = `
      <div class="container">
        <p class="footer-links">
          ${['关于我们', '配送说明', '售后服务', '帮助中心']
            .map((it) => `<a href="#" data-toast="「${it}」将在后续更新中开放">${it}</a>`)
            .join('<span aria-hidden="true">·</span>')}
        </p>
        <p class="footer-legal">
          本站为个人前端学习作品，页面与商品信息均为演示数据，不提供真实交易。<br>
          © 2026 ${JD.brand.name}
        </p>
      </div>
    `;
  }

  function updateBadges() {
    const badge = document.getElementById('msgBadge');
    const unread = messages.unreadCount();
    if (!badge) return;
    badge.textContent = unread;
    badge.hidden = unread === 0;

    // 消息页自身的未读数也在用
    const pageBadge = document.querySelector('[data-unread-count]');
    if (pageBadge) pageBadge.textContent = unread;
  }

  /* ---------------- 商品详情弹层 ---------------- */
  let modalEl = null;
  let detailState = null;

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.className = 'modal';
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="modal-mask" data-close></div>
      <div class="modal-panel detail-panel" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
        <button class="modal-close" type="button" data-close aria-label="关闭">✕</button>
        <div id="detailBody"></div>
      </div>
    `;
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) closeDetail();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modalEl.hidden) closeDetail();
    });

    return modalEl;
  }

  /** 当前选择规格对应的单价（基础价 + 各选项加价） */
  function unitPrice() {
    const { product, spec } = detailState;
    const extra = product.specExtra || {};
    const delta = Object.values(spec).reduce((sum, value) => sum + (extra[value] || 0), 0);
    return round2(product.price + delta);
  }

  function detailHtml() {
    const { product, qty } = detailState;
    const spec = detailState.spec;
    const faved = fav.has(product.id);
    const specKeys = Object.keys(product.specs || {});
    const price = unitPrice();
    const lowStock = product.stock <= 10;
    const filled = Math.round(product.rating);
    const reviews = (JD.reviews[product.cat] || []).slice(0, 2);

    return `
      <div class="detail-media">
        <img src="${product.img}" alt="${esc(product.name)}" width="400" height="400">
        ${product.tag ? `<span class="tag">${esc(product.tag)}</span>` : ''}
      </div>
      <div class="detail-info">
        <h2 class="detail-title" id="detailTitle">${esc(product.name)}</h2>
        <p class="detail-desc">${esc(product.desc)}</p>
        <p class="detail-price">
          <span class="price"><span class="yen">¥</span>${money(price)}</span>
          <del class="origin">¥${money(product.origin)}</del>
          <span class="detail-sales">${esc(product.sales)} 人付款</span>
        </p>

        <div class="detail-rating">
          <span class="review-stars" aria-label="评分 ${product.rating}">
            ${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}
          </span>
          <b>${product.rating}</b>
          <span>好评率 ${Math.round(product.rating * 20)}%</span>
          <span class="detail-stock${lowStock ? ' is-low' : ''}">
            ${lowStock ? `仅剩 ${product.stock} 件` : `库存 ${product.stock} 件`}
          </span>
        </div>

        <p class="detail-promo">限时直降 · 满 3000 减 300 · 支持 12 期免息</p>

        ${specKeys.map((key) => `
          <div class="detail-row">
            <span class="detail-label">${esc(key)}</span>
            <div class="chips">
              ${product.specs[key].map((value) => `
                <button type="button" class="chip${spec[key] === value ? ' is-active' : ''}"
                        data-spec="${esc(key)}" data-value="${esc(value)}">${esc(value)}</button>`).join('')}
            </div>
          </div>`).join('')}

        <div class="detail-row">
          <span class="detail-label">数量</span>
          <div class="stepper">
            <button type="button" data-step="-1" aria-label="减少">−</button>
            <input id="detailQty" value="${qty}" readonly aria-label="购买数量">
            <button type="button" data-step="1" aria-label="增加">+</button>
          </div>
          <span class="detail-limit">每单限购 ${product.stock} 件</span>
        </div>

        <p class="detail-service">7 天无理由退货 · 全国联保 · 顺丰包邮</p>

        <div class="detail-actions">
          <button type="button" class="btn btn-ghost" data-fav>${faved ? '★ 已收藏' : '☆ 收藏'}</button>
          <button type="button" class="btn btn-primary" data-buy>立即购买</button>
        </div>
      </div>

      <section class="detail-reviews">
        <h3>用户评价 <span>共 ${esc(product.sales)} 条</span></h3>
        ${reviews.map((review) => `
          <div class="review">
            <div class="review-head">
              <span>${esc(review.user)}</span>
              <span class="review-stars" aria-label="${review.stars} 星">${'★'.repeat(review.stars)}${'☆'.repeat(5 - review.stars)}</span>
            </div>
            <p>${esc(review.text)}</p>
          </div>`).join('')}
      </section>
    `;
  }

  function paintDetail() {
    const body = modalEl.querySelector('#detailBody');
    body.innerHTML = detailHtml();

    body.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        detailState.spec[chip.dataset.spec] = chip.dataset.value;
        paintDetail();
      });
    });

    body.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const max = Math.min(99, detailState.product.stock);
        detailState.qty = Math.min(max, Math.max(1, detailState.qty + Number(btn.dataset.step)));
        paintDetail();
      });
    });

    body.querySelector('[data-fav]').addEventListener('click', () => {
      const nowFaved = fav.toggle(detailState.product.id);
      paintDetail();
      toast(nowFaved ? '已加入收藏' : '已取消收藏');
    });

    body.querySelector('[data-buy]').addEventListener('click', () => {
      const { product, spec, qty } = detailState;
      const specText = Object.values(spec).filter(Boolean).join(' / ');
      const order = orders.create([{ productId: product.id, spec: specText, qty, price: unitPrice() }]);
      if (!order) return;
      closeDetail();
      toast('下单成功，正在跳转订单页…');
      setTimeout(() => { location.href = 'orders.html'; }, 900);
    });
  }

  function openDetail(productId) {
    const product = JD.getProduct(productId);
    if (!product) return;

    const spec = {};
    Object.entries(product.specs || {}).forEach(([key, values]) => { spec[key] = values[0]; });

    detailState = { product, spec, qty: 1 };
    ensureModal();
    paintDetail();
    modalEl.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeDetail() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.style.overflow = '';
  }

  /* ---------------- 全局事件 ---------------- */
  function bindGlobalEvents() {
    document.addEventListener('click', (event) => {
      const hint = event.target.closest('[data-toast]');
      if (hint) {
        event.preventDefault();
        toast(hint.dataset.toast);
      }
    });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    seed();
    renderHeader();
    renderFooter();
    updateBadges();
    bindGlobalEvents();
  }

  Object.assign(JD, {
    store, money, esc, stamp,
    user, orders, messages, fav,
    toast, openDetail, closeDetail,
    updateBadges, STATUS_TEXT,
  });

  JD.init = init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
