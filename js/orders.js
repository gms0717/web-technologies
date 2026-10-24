/* =========================================================
   orders.js — 订单页
   按状态筛选 / 付款 / 取消 / 确认收货 / 再次购买 / 删除
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

  let active = new URLSearchParams(location.search).get('status') || 'all';

  function actions(order) {
    const id = order.id;
    switch (order.status) {
      case 'unpaid':
        return `<button class="btn btn-ghost btn-sm" data-act="cancel" data-id="${id}">取消订单</button>
                <button class="btn btn-primary btn-sm" data-act="pay" data-id="${id}">立即付款</button>`;
      case 'paid':
        return `<button class="btn btn-ghost btn-sm" data-act="remind" data-id="${id}">提醒发货</button>`;
      case 'shipped':
        return `<button class="btn btn-primary btn-sm" data-act="receive" data-id="${id}">确认收货</button>`;
      case 'done':
        return `<button class="btn btn-ghost btn-sm" data-act="delete" data-id="${id}">删除订单</button>
                <button class="btn btn-ghost btn-sm" data-act="rebuy" data-id="${id}">再次购买</button>`;
      case 'cancelled':
        return `<button class="btn btn-ghost btn-sm" data-act="delete" data-id="${id}">删除订单</button>`;
      default:
        return '';
    }
  }

  function orderCard(order) {
    const count = order.items.reduce((sum, it) => sum + it.qty, 0);

    return `
      <article class="order-card">
        <div class="order-head">
          <span>订单号 ${esc(order.no)}</span>
          <span>${esc(order.time)}</span>
          <span class="order-status st-${order.status}">${STATUS_TEXT[order.status] || order.status}</span>
        </div>
        <div class="order-items">
          ${order.items.map((it) => `
            <div class="order-item">
              <img src="${it.img}" alt="" width="64" height="64">
              <div class="order-item-info">
                <p class="order-item-name">${esc(it.name)}</p>
                <p class="order-item-spec">${esc(it.spec)}</p>
              </div>
              <span class="order-item-price">¥${money(it.price)}</span>
              <span class="order-item-qty">×${it.qty}</span>
            </div>`).join('')}
        </div>
        <div class="order-foot">
          <span class="order-total">共 ${count} 件，合计 <b>¥${money(order.total)}</b></span>
          ${actions(order)}
        </div>
      </article>`;
  }

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
        render();
      });
    });
  }

  function renderList() {
    const listHost = document.getElementById('orderList');
    const emptyHost = document.getElementById('orderEmpty');
    const summary = document.getElementById('orderSummary');
    if (!listHost || !emptyHost) return;

    const list = JD.orders.byStatus(active);

    listHost.innerHTML = list.map(orderCard).join('');
    listHost.hidden = list.length === 0;
    emptyHost.hidden = list.length > 0;

    if (summary) summary.textContent = `共 ${JD.orders.all().length} 笔订单`;

    emptyHost.innerHTML = `
      <div class="empty-icon">📦</div>
      <p>${active === 'all' ? '还没有订单，去首页挑选喜欢的商品吧' : '该状态下暂无订单'}</p>
      <a class="btn btn-primary" href="index.html">去逛逛</a>`;
  }

  function render() {
    renderTabs();
    renderList();
  }

  function bindActions() {
    const host = document.getElementById('orderList');
    if (!host) return;

    host.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-act]');
      if (!btn) return;

      const order = JD.orders.all().find((o) => o.id === btn.dataset.id);
      if (!order) return;

      switch (btn.dataset.act) {
        case 'pay':
          JD.orders.update(order.id, { status: 'paid' });
          JD.toast('支付成功，等待发货');
          break;
        case 'cancel':
          if (window.confirm('确定取消这笔订单吗？')) {
            JD.orders.update(order.id, { status: 'cancelled' });
            JD.toast('订单已取消');
          }
          break;
        case 'remind':
          JD.toast('已提醒商家尽快发货');
          break;
        case 'receive':
          JD.orders.update(order.id, { status: 'done' });
          JD.toast('已确认收货，感谢购买');
          break;
        case 'delete':
          if (window.confirm('删除后不可恢复，确定删除吗？')) {
            JD.orders.remove(order.id);
            JD.toast('订单已删除');
          }
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
