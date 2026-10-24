/* =========================================================
   profile.js — 我的页面
   个人信息 / 订单统计 / 资产 / 常用功能
   ========================================================= */
(function () {
  'use strict';

  const { esc } = JD;

  function renderHero() {
    const host = document.getElementById('profileHero');
    if (!host) return;

    const me = JD.user.get();
    host.innerHTML = `
      <div class="avatar-lg" aria-hidden="true">${esc(me.name.slice(0, 1))}</div>
      <div>
        <div class="profile-name" id="profileName">
          ${esc(me.name)}<span class="level">${esc(me.level)}</span>
        </div>
        <div class="profile-edit" id="editBox" hidden>
          <input id="nameInput" maxlength="12" aria-label="昵称" value="${esc(me.name)}">
          <button class="btn btn-primary btn-sm" id="saveName" type="button">保存</button>
          <button class="btn btn-ghost btn-sm" id="cancelName" type="button">取消</button>
        </div>
        <div class="profile-sub">积分 ${me.points} · 优惠券 ${me.coupons} 张 · 红包 ${me.redPacket} 个</div>
      </div>
      <div class="profile-actions">
        <button class="btn btn-ghost" id="editName" type="button">编辑资料</button>
        <button class="btn btn-ghost" id="resetDemo" type="button">重置演示数据</button>
      </div>
    `;

    const nameEl = host.querySelector('#profileName');
    const editBox = host.querySelector('#editBox');
    const input = host.querySelector('#nameInput');

    host.querySelector('#editName').addEventListener('click', () => {
      nameEl.hidden = true;
      editBox.hidden = false;
      input.value = JD.user.get().name;
      input.focus();
      input.select();
    });

    host.querySelector('#cancelName').addEventListener('click', () => {
      editBox.hidden = true;
      nameEl.hidden = false;
    });

    host.querySelector('#saveName').addEventListener('click', () => {
      const name = input.value.trim();
      if (!name) {
        JD.toast('昵称不能为空');
        return;
      }
      JD.user.set({ name });
      location.reload();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') host.querySelector('#saveName').click();
    });

    host.querySelector('#resetDemo').addEventListener('click', () => {
      if (!window.confirm('将清空订单、消息、收藏和昵称等本地演示数据，确定重置吗？')) return;
      ['yx_user', 'yx_orders', 'yx_messages', 'yx_fav', 'yx_seeded'].forEach((key) => JD.store.remove(key));
      location.reload();
    });
  }

  function renderStats() {
    const host = document.getElementById('statGrid');
    if (!host) return;

    const counts = JD.orders.counts();
    const items = [
      ['unpaid', '待付款'],
      ['paid', '待发货'],
      ['shipped', '待收货'],
      ['done', '已完成'],
    ];

    host.innerHTML = items.map(([key, label]) => `
      <a class="stat" href="orders.html?status=${key}">
        <b>${counts[key] || 0}</b>
        <span>${label}</span>
      </a>`).join('');
  }

  function renderAssets() {
    const host = document.getElementById('assetGrid');
    if (!host) return;

    const me = JD.user.get();
    host.innerHTML = `
      <div class="asset"><b>${me.coupons}</b><span>优惠券</span></div>
      <div class="asset"><b>${me.points}</b><span>积分</span></div>
      <div class="asset"><b>${me.redPacket}</b><span>红包</span></div>
    `;
  }

  function renderMenu() {
    const host = document.getElementById('menuGrid');
    if (!host) return;

    const items = [
      ['📍', '收货地址'],
      ['⭐', '收藏商品'],
      ['🕘', '浏览记录'],
      ['❓', '帮助中心'],
    ];

    host.innerHTML = items.map(([icon, label]) => `
      <a class="menu-item" href="#" data-toast="「${label}」将在后续更新中开放">
        <span class="menu-icon" aria-hidden="true">${icon}</span>${label}
      </a>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHero();
    renderStats();
    renderAssets();
    renderMenu();
  });
})();
