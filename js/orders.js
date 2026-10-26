/* =========================================================
   orders.js — 订单页
   状态页签 / 流程进度 / 订单详情展开 / 分页 / 状态操作
   ========================================================= */
(function () {
  'use strict';

  const { money, esc, STATUS_TEXT } = JD;

  const TABS = [
    ['all', '全部'],
    ['unpaid', '待付款'],
    ['paid', '待发货'],
    ['shipped', '待收货'],
    ['done', '已完成'],
  ];

  /** 流程节点：已完成的节点数（done 表示全部完成） */
  const STEPS = ['提交订单', '付款', '发货', '收货', '完成'];
  const DONE_STEPS = { unpaid: 1, paid: 2, shipped: 3, done: 5 };

  const HINTS = {
    unpaid: '请在 24 小时内完成付款，超时订单将自动取消',
    paid: '商家正在备货，预计 24 小时内发出',
    shipped: '包裹运输中，预计明日送达',
    done: '交易已完成，感谢你的购买',
  };

  const PAGE_SIZE = 5;

  let active = new URLSearchParams(location.search).get('status') || 'all';
  let page = 1;
  let expandedId = null;

  /* ---------------- 片段 ---------------- */
  function stepsHtml(order) {
    if (order.status === 'cancelled') {
      return `<div class="order-flow"><p class="order-hint is-cancelled">订单已取消，你仍然可以再次购买</p></div>`;
    }

    const done = DONE_STEPS[order.status] ?? 0;
    return `
      <div class="order-flow">
        <div class="order-steps">
          ${STEPS.map((label, index) => `
            ${index ? '<span class="step-line"></span>' : ''}
            <span class="step${index < done ? ' is-done' : index === done ? ' is-current' : ''}">${label}</span>
          `).join('')}
        </div>
        <p class="order-hint">${HINTS[order.status] || ''}</p>
      </div>`;
  }

  function itemHtml(item) {
    return `
      <div class="order-item">
        <img src="${item.img}" alt="" width="64" height="64">
        <div class="order-item-info">
          <p class="order-item-name">${esc(item.name)}</p>
          <p class="order-item-spec">${esc(item.spec)}</p>
        </div>
        <span class="order-item-price">¥${money(item.price)}</span>
        <span class="order-item-qty">×${item.qty}</span>
      </div>`;
  }

  function detailHtml(order) {
    const address = order.address || JD.defaultAddress;
    const goodsTotal = order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const discount = Math.round((goodsTotal - order.total) * 100) / 100;

    return `
      <div class="order-detail">
        <div class="od-cols">
          <div class="od-col">
            <h5>收货信息</h5>
            <p>${esc(address.name)} ${esc(address.phone)}</p>
            <p>${esc(address.region)} ${esc(address.detail)}</p>
          </div>
          <div class="od-col">
            <h5>支付与订单</h5>
            <p>支付方式：${esc(order.payment || '在线支付')}</p>
            <p>订单编号：${esc(order.no)}</p>
            <p>下单时间：${esc(order.time)}</p>
          </div>
        </div>
        <div class="od-amount">
          <span>商品总额 ¥${money(goodsTotal)}</span>
          <span>运费 ¥0</span>
          <span>优惠 -¥${money(discount)}</span>
          <span class="od-total">实付 ¥${money(order.total)}</span>
        </div>
      </div>`;
  }

  function actions(order) {
    const id = order.id;
    const detail = `<button class="btn btn-ghost btn-sm" data-act="detail" data-id="${id}">${
      expandedId === id ? '收起详情' : '订单详情'
    }</button>`;

    switch (order.status) {
      case 'unpaid':
        return `${detail}
          <button class="btn btn-ghost btn-sm" data-act="cancel" data-id="${id}">取消订单</button>
          <button class="btn btn-primary btn-sm" data-act="pay" data-id="${id}">立即付款</button>`;
      case 'paid':
        return `${detail}
          <button class="btn btn-ghost btn-sm" data-act="remind" data-id="${id}">提醒发货</button>`;
      case 'shipped':
        return `${detail}
          <button class="btn btn-primary btn-sm" data-act="receive" data-id="${id}">确认收货</button>`;
      case 'done':
        return `${detail}
          <button class="btn btn-ghost btn-sm" data-act="delete" data-id="${id}">删除订单</button>
          <button class="btn btn-ghost btn-sm" data-act="rebuy" data-id="${id}">再次购买</button>`;
      case 'cancelled':
        return `${detail}
          <button class="btn btn-ghost btn-sm" data-act="delete" data-id="${id}">删除订单</button>
          <button class="btn btn-ghost btn-sm" data-act="rebuy" data-id="${id}">再次购买</button>`;
      default:
        return detail;
    }
  }

  function card(order) {
    const count = order.items.reduce((sum, it) => sum + it.qty, 0);

    return `
      <article class="order-card" data-order="${order.id}">
        <div class="order-head">
          <span>订单号 ${esc(order.no)}</span>
          <span>${esc(order.time)}</span>
          <span class="order-status st-${order.status}">${STATUS_TEXT[order.status] || order.status}</span>
        </div>
        ${stepsHtml(order)}
        <div class="order-items">${order.items.map(itemHtml).join('')}</div>
        ${expandedId === order.id ? detailHtml(order) : ''}
        <div class="order-foot">
          <span class="order-total">共 ${count} 件，合计 <b>¥${money(order.total)}</b></span>
          ${actions(order)}
        </div>
      </article>`;
  }

  /* ---------------- 渲染 ---------------- */
  function renderTabs() {
    const host = document.getElementById('orderTabs');
    if (!host) return;

    host.innerHTML = TABS.map(([key, label]) => {
      const n = JD.orders.byStatus(key).length;
      return `<button type="button" class="tab${active === key ? ' is-active' : ''}" data-status="${key}">
                ${label}${n ? `（${n}）` : ''}
              </button>`;
    }).join('');

    host.querySelectorAll('[data-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        active = btn.dataset.status;
        page = 1;
        expandedId = null;
        render();
      });
    });
  }

  function renderPager(totalPages) {
    const host = document.getElementById('pager');
    if (!host) return;

    if (totalPages <= 1) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }

    host.hidden = false;
    host.innerHTML = `
      <button type="button" class="btn btn-ghost btn-sm" data-page="prev" ${page === 1 ? 'disabled' : ''}>上一页</button>
      <span class="pager-info">第 ${page} / ${totalPages} 页</span>
      <button type="button" class="btn btn-ghost btn-sm" data-page="next" ${page === totalPages ? 'disabled' : ''}>下一页</button>
    `;

    host.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        page += btn.dataset.page === 'next' ? 1 : -1;
        expandedId = null;
        render();
      });
    });
  }

  function render() {
    const listHost = document.getElementById('orderList');
    const emptyHost = document.getElementById('orderEmpty');
    const summary = document.getElementById('orderSummary');
    if (!listHost || !emptyHost) return;

    const list = JD.orders.byStatus(active);
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > totalPages) page = totalPages;

    const visible = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    renderTabs();
    listHost.innerHTML = visible.map(card).join('');
    listHost.hidden = list.length === 0;
    emptyHost.hidden = list.length > 0;
    renderPager(totalPages);

    if (summary) summary.textContent = `共 ${JD.orders.all().length} 笔订单`;

    emptyHost.innerHTML = `
      <div class="empty-icon">📦</div>
      <p>${active === 'all' ? '还没有订单，去首页挑选喜欢的商品吧' : '该状态下暂无订单'}</p>
      <a class="btn btn-primary" href="index.html">去逛逛</a>`;
  }

  /* ---------------- 交互 ---------------- */
  function bindActions() {
    const host = document.getElementById('orderList');
    if (!host) return;

    host.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;

      const order = JD.orders.all().find((o) => o.id === btn.dataset.id);
      if (!order) return;

      switch (btn.dataset.act) {
        case 'detail':
          expandedId = expandedId === order.id ? null : order.id;
          break;
        case 'pay':
          JD.orders.update(order.id, { status: 'paid' });
          expandedId = null;
          JD.toast('支付成功，等待发货');
          break;
        case 'cancel':
          if (!window.confirm('确定取消这笔订单吗？')) return;
          JD.orders.update(order.id, { status: 'cancelled' });
          expandedId = null;
          JD.toast('订单已取消');
          break;
        case 'remind':
          JD.toast('已提醒商家尽快发货');
          break;
        case 'receive':
          JD.orders.update(order.id, { status: 'done' });
          expandedId = null;
          JD.toast('已确认收货，感谢购买');
          break;
        case 'delete':
          if (!window.confirm('删除后不可恢复，确定删除吗？')) return;
          JD.orders.remove(order.id);
          expandedId = null;
          JD.toast('订单已删除');
          break;
        case 'rebuy':
          JD.orders.create(order.items.map((it) => ({
            productId: it.productId, spec: it.spec, qty: it.qty, price: it.price,
          })));
          JD.toast('已重新下单，请在「待付款」中查看');
          break;
        default:
          return;
      }

      render();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    bindActions();
  });
})();
