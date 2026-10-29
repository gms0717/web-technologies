/* =========================================================
   orders.js — 订单页
   状态页签 / 流程进度 / 订单详情 / 分页 / 状态操作 / 评价
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

  /** 订单进度：按已有时间戳生成事件 */
  function events(order) {
    return [
      { label: '提交订单', time: order.time },
      { label: '支付成功', time: order.paidAt },
      { label: '商品发出', time: order.shippedAt },
      { label: '确认收货', time: order.doneAt },
      { label: '订单取消', time: order.cancelledAt },
    ].filter((item) => item.time);
  }

  function detailHtml(order) {
    const address = order.address || JD.addresses.getDefault();
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
          <div class="od-col">
            <h5>订单进度</h5>
            <ul class="od-timeline">
              ${events(order).map((evt) => `
                <li><span>${esc(evt.label)}</span><time>${esc(evt.time)}</time></li>`).join('')}
            </ul>
          </div>
        </div>

        ${order.review ? `
          <div class="od-review">
            <h5>我的评价</h5>
            <p><span class="review-stars">${'★'.repeat(order.review.stars)}</span>
               <span class="od-review-time">${esc(order.review.time)}</span></p>
            <p>${esc(order.review.text || '此用户没有填写评价内容')}</p>
          </div>` : ''}

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
          ${order.review
            ? '<button class="btn btn-ghost btn-sm" type="button" disabled>已评价</button>'
            : `<button class="btn btn-ghost btn-sm" data-act="review" data-id="${id}">评价晒单</button>`}
          <button class="btn btn-ghost btn-sm" data-act="rebuy" data-id="${id}">再次购买</button>
          <button class="btn btn-ghost btn-sm" data-act="delete" data-id="${id}">删除订单</button>`;
      case 'cancelled':
        return `${detail}
          <button class="btn btn-ghost btn-sm" data-act="rebuy" data-id="${id}">再次购买</button>
          <button class="btn btn-ghost btn-sm" data-act="delete" data-id="${id}">删除订单</button>`;
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

  /* ---------------- 评价弹层 ---------------- */
  let reviewStars = 5;

  function openReview(order) {
    reviewStars = 5;

    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `
      <div class="modal-mask" data-close></div>
      <div class="review-panel" role="dialog" aria-modal="true" aria-labelledby="reviewTitle">
        <button class="modal-close" type="button" data-close aria-label="关闭">✕</button>
        <h3 id="reviewTitle">评价商品</h3>
        <p class="review-goods">${esc(order.items.map((it) => it.name).join('、'))}</p>
        <div class="star-input" role="radiogroup" aria-label="评分">
          ${[1, 2, 3, 4, 5].map((n) => `
            <button type="button" class="star${n <= reviewStars ? ' is-on' : ''}" data-star="${n}" aria-label="${n} 星">★</button>
          `).join('')}
        </div>
        <textarea id="reviewText" rows="3" maxlength="80" placeholder="说说你的使用感受（选填）"></textarea>
        <div class="review-actions">
          <button type="button" class="btn btn-ghost" data-close>取消</button>
          <button type="button" class="btn btn-primary" data-submit>提交评价</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const paint = () => {
      el.querySelectorAll('.star').forEach((star) => {
        star.classList.toggle('is-on', Number(star.dataset.star) <= reviewStars);
      });
    };

    el.addEventListener('click', (event) => {
      const star = event.target.closest('[data-star]');
      if (star) {
        reviewStars = Number(star.dataset.star);
        paint();
        return;
      }

      if (event.target.closest('[data-submit]')) {
        JD.orders.update(order.id, {
          review: {
            stars: reviewStars,
            text: el.querySelector('#reviewText').value.trim(),
            time: JD.stamp(),
          },
        });
        el.remove();
        JD.toast('评价已提交，感谢反馈');
        render();
        return;
      }

      if (event.target.closest('[data-close]')) el.remove();
    });
  }

  /* ---------------- 交互 ---------------- */
  function bindActions() {
    const host = document.getElementById('orderList');
    if (!host) return;

    host.addEventListener('click', async (event) => {
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
          JD.toast('支付成功，可在「待发货」中查看', {
            actionText: '去看看',
            onAction: () => {
              active = 'paid';
              page = 1;
              render();
            },
          });
          break;

        case 'cancel': {
          const ok = await JD.confirm({
            title: '取消订单',
            message: '取消后商品库存会释放，确定取消这笔订单吗？',
            okText: '确定取消',
            cancelText: '再想想',
            danger: true,
          });
          if (!ok) return;
          JD.orders.update(order.id, { status: 'cancelled' });
          expandedId = null;
          JD.toast('订单已取消', {
            actionText: '撤销',
            duration: 6000,
            onAction: () => {
              JD.orders.update(order.id, { status: 'unpaid', cancelledAt: null });
              JD.toast('已恢复为待付款');
              render();
            },
          });
          break;
        }

        case 'remind':
          JD.toast('已提醒商家尽快发货');
          break;

        case 'receive': {
          const ok = await JD.confirm({
            title: '确认收货',
            message: '请确认已收到商品，确认后订单将完成。',
            okText: '确认收货',
          });
          if (!ok) return;
          JD.orders.update(order.id, { status: 'done' });
          expandedId = null;
          JD.toast('已确认收货，记得给个评价');
          break;
        }

        case 'delete': {
          const ok = await JD.confirm({
            title: '删除订单',
            message: '删除后订单记录不可恢复，确定删除吗？',
            okText: '删除',
            danger: true,
          });
          if (!ok) return;
          JD.orders.remove(order.id);
          expandedId = null;
          JD.toast('订单已删除');
          break;
        }

        case 'rebuy':
          JD.orders.create(order.items.map((it) => ({
            productId: it.productId, spec: it.spec, qty: it.qty, price: it.price,
          })));
          JD.toast('已重新下单，请在「待付款」中查看');
          break;

        case 'review':
          openReview(order);
          return;

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
