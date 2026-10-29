/* =========================================================
   profile.js — 我的页面
   个人信息 / 订单统计 / 资产明细 / 常用功能 / 收货地址管理
   ========================================================= */
(function () {
  'use strict';

  const { esc } = JD;

  /* ---------------- 个人信息 ---------------- */
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

    host.querySelector('#resetDemo').addEventListener('click', async () => {
      const ok = await JD.confirm({
        title: '重置演示数据',
        message: '将清空订单、消息、收货地址、收藏和昵称等本地数据，恢复为初始示例。',
        okText: '确定重置',
        danger: true,
      });
      if (!ok) return;
      ['yx_user', 'yx_orders', 'yx_messages', 'yx_fav', 'yx_seeded', 'yx_addresses'].forEach((key) => JD.store.remove(key));
      location.reload();
    });
  }

  /* ---------------- 订单统计 ---------------- */
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

  /* ---------------- 我的资产 ---------------- */
  function renderAssets() {
    const host = document.getElementById('assetGrid');
    if (!host) return;

    const me = JD.user.get();
    host.innerHTML = `
      <button type="button" class="asset" data-asset="coupons"><b>${me.coupons}</b><span>优惠券</span></button>
      <button type="button" class="asset" data-asset="points"><b>${me.points}</b><span>积分</span></button>
      <button type="button" class="asset" data-asset="packets"><b>${me.redPacket}</b><span>红包</span></button>
    `;

    host.querySelectorAll('[data-asset]').forEach((btn) => {
      btn.addEventListener('click', () => openAssets(btn.dataset.asset));
    });
  }

  function openAssets(kind) {
    const TITLES = { coupons: '优惠券', points: '积分明细', packets: '红包' };
    const list = (JD.assets && JD.assets[kind]) || [];

    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `
      <div class="modal-mask" data-close></div>
      <div class="asset-panel" role="dialog" aria-modal="true" aria-labelledby="assetTitle">
        <button class="modal-close" type="button" data-close aria-label="关闭">✕</button>
        <h3 id="assetTitle">${TITLES[kind]}</h3>
        <div class="asset-list">
          ${list.map((item) => `
            <div class="asset-row">
              <div class="asset-row-main">
                <h4>${esc(item.title)}</h4>
                <p>${esc(item.desc || '')}</p>
              </div>
              <b>${item.amount || `¥${item.value}`}</b>
              ${item.amount ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-use>去使用</button>'}
            </div>`).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) el.remove();
      else if (event.target.closest('[data-use]')) JD.toast('可在下单时使用（演示）');
    });
  }

  /* ---------------- 收货地址 ---------------- */
  function openAddresses() {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `
      <div class="modal-mask" data-close></div>
      <div class="addr-panel" role="dialog" aria-modal="true" aria-labelledby="addrTitle">
        <button class="modal-close" type="button" data-close aria-label="关闭">✕</button>
        <h3 id="addrTitle">收货地址</h3>
        <div id="addrBody"></div>
      </div>
    `;
    document.body.appendChild(el);

    const body = el.querySelector('#addrBody');
    let editing = null;

    function paintList() {
      editing = null;
      const list = JD.addresses.all();

      body.innerHTML = `
        <p class="addr-tip">共 ${list.length} 个地址，下单时默认使用标有「默认」的地址</p>
        <div class="addr-list">
          ${list.length ? list.map((addr) => `
            <div class="addr-item${addr.isDefault ? ' is-default' : ''}">
              <div class="addr-line1">
                <span>${esc(addr.name)}</span>
                <span class="addr-phone">${esc(addr.phone)}</span>
                ${addr.isDefault ? '<span class="addr-badge">默认</span>' : ''}
              </div>
              <p class="addr-text">${esc(addr.region)} ${esc(addr.detail)}</p>
              <div class="addr-actions">
                ${addr.isDefault
                  ? '<span class="addr-current">当前默认地址</span>'
                  : `<button type="button" data-default="${addr.id}">设为默认</button>`}
                <button type="button" data-edit="${addr.id}">编辑</button>
                <button type="button" data-del="${addr.id}">删除</button>
              </div>
            </div>`).join('') : '<p class="addr-empty">还没有收货地址，先新增一个吧</p>'}
        </div>
        <div class="addr-foot">
          <button type="button" class="btn btn-primary" data-add>新增地址</button>
        </div>
      `;
    }

    function paintForm(address) {
      editing = address || {};
      const addr = editing;

      body.innerHTML = `
        <div class="addr-form">
          <div class="field">
            <label for="fName">收货人</label>
            <input id="fName" maxlength="12" value="${esc(addr.name || '')}" placeholder="请输入收货人姓名">
          </div>
          <div class="field">
            <label for="fPhone">手机号</label>
            <input id="fPhone" maxlength="11" inputmode="numeric" value="${esc(addr.phone || '')}" placeholder="11 位手机号">
          </div>
          <div class="field is-full">
            <label for="fRegion">所在地区</label>
            <input id="fRegion" maxlength="30" value="${esc(addr.region || '')}" placeholder="如：北京市 朝阳区">
          </div>
          <div class="field is-full">
            <label for="fDetail">详细地址</label>
            <input id="fDetail" maxlength="50" value="${esc(addr.detail || '')}" placeholder="街道、门牌号、楼层等">
          </div>
          <label class="checkbox is-full">
            <input type="checkbox" id="fDefault" ${addr.isDefault ? 'checked' : ''}> 设为默认收货地址
          </label>
          <p class="addr-error is-full" id="addrError" hidden></p>
        </div>
        <div class="addr-foot">
          <button type="button" class="btn btn-ghost" data-back>返回</button>
          <button type="button" class="btn btn-primary" data-save>保存</button>
        </div>
      `;
    }

    function showError(text) {
      const box = body.querySelector('#addrError');
      box.hidden = false;
      box.textContent = text;
    }

    el.addEventListener('click', async (event) => {
      if (event.target.closest('[data-close]')) {
        el.remove();
        return;
      }

      const edit = event.target.closest('[data-edit]');
      if (edit) {
        paintForm(JD.addresses.get(edit.dataset.edit));
        return;
      }

      const del = event.target.closest('[data-del]');
      if (del) {
        const ok = await JD.confirm({
          title: '删除地址',
          message: '删除后该地址不能再用于下单，确定删除吗？',
          okText: '删除',
          danger: true,
        });
        if (!ok) return;
        JD.addresses.remove(del.dataset.del);
        JD.toast('地址已删除');
        paintList();
        return;
      }

      const def = event.target.closest('[data-default]');
      if (def) {
        JD.addresses.setDefault(def.dataset.default);
        JD.toast('已设为默认地址');
        paintList();
        return;
      }

      if (event.target.closest('[data-add]')) {
        paintForm(null);
        return;
      }

      if (event.target.closest('[data-back]')) {
        paintList();
        return;
      }

      if (event.target.closest('[data-save]')) {
        const data = {
          id: editing && editing.id,
          name: body.querySelector('#fName').value.trim(),
          phone: body.querySelector('#fPhone').value.trim(),
          region: body.querySelector('#fRegion').value.trim(),
          detail: body.querySelector('#fDetail').value.trim(),
          isDefault: body.querySelector('#fDefault').checked,
        };

        if (data.name.length < 2) return showError('请填写收货人姓名（至少 2 个字）');
        if (!/^1[3-9]\d{9}$/.test(data.phone)) return showError('请填写正确的 11 位手机号');
        if (data.region.length < 2) return showError('请填写所在地区');
        if (data.detail.length < 5) return showError('请填写详细地址（至少 5 个字）');

        JD.addresses.upsert(data);
        JD.toast('地址已保存');
        paintList();
      }
    });

    paintList();
  }

  /* ---------------- 常用功能 ---------------- */
  function renderMenu() {
    const host = document.getElementById('menuGrid');
    if (!host) return;

    const items = [
      { icon: '📍', label: '收货地址', action: 'addresses' },
      { icon: '⭐', label: '收藏商品' },
      { icon: '🕘', label: '浏览记录' },
      { icon: '❓', label: '帮助中心' },
    ];

    host.innerHTML = items.map((item) => (item.action
      ? `<button type="button" class="menu-item" data-action="${item.action}">
           <span class="menu-icon" aria-hidden="true">${item.icon}</span>${item.label}
         </button>`
      : `<a class="menu-item" href="#" data-toast="「${item.label}」将在后续更新中开放">
           <span class="menu-icon" aria-hidden="true">${item.icon}</span>${item.label}
         </a>`)).join('');

    const addrBtn = host.querySelector('[data-action="addresses"]');
    if (addrBtn) addrBtn.addEventListener('click', openAddresses);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHero();
    renderStats();
    renderAssets();
    renderMenu();
  });
})();
