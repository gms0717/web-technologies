/* =========================================================
   messages.js — 消息页
   分类筛选 / 未读角标 / 消息详情弹层 / 删除与撤销
   ========================================================= */
(function () {
  'use strict';

  const { esc } = JD;
  const ICON = { logistics: '📦', promo: '🎁', system: '📢' };
  const CAT_NAME = Object.fromEntries(JD.messageCats.map((cat) => [cat.id, cat.name]));

  let active = 'all';

  const unreadOf = (cat) =>
    JD.messages.all().filter((m) => (cat === 'all' || m.cat === cat) && !m.read).length;

  /** 按时间倒序（保持列表稳定，避免消息已读后位置跳动） */
  function sortMessages(list) {
    return [...list].sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
  }

  function renderTabs() {
    const host = document.getElementById('msgTabs');
    if (!host) return;

    host.innerHTML = JD.messageCats.map((cat) => {
      const n = unreadOf(cat.id);
      return `<button type="button" class="tab${active === cat.id ? ' is-active' : ''}" data-cat="${cat.id}">
                ${esc(cat.name)}${n ? `<span class="tab-badge">${n}</span>` : ''}
              </button>`;
    }).join('');

    host.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        active = btn.dataset.cat;
        render();
      });
    });
  }

  function renderList() {
    const host = document.getElementById('msgList');
    if (!host) return;

    const list = sortMessages(JD.messages.all().filter((m) => active === 'all' || m.cat === active));

    if (!list.length) {
      host.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <p>暂无消息</p>
        </div>`;
      return;
    }

    host.innerHTML = list.map((m) => `
      <div class="msg-item${m.read ? '' : ' is-unread'}" data-id="${m.id}" role="button" tabindex="0"
           aria-label="查看消息 ${esc(m.title)}${m.read ? '' : '（未读）'}">
        <span class="msg-icon" aria-hidden="true">${ICON[m.cat] || '🔔'}</span>
        <div class="msg-body">
          <p class="msg-title">${esc(m.title)}${m.read ? '' : '<span class="dot" aria-label="未读"></span>'}</p>
          <p class="msg-text">${esc(m.text)}</p>
        </div>
        <span class="msg-time">${esc(m.time)}</span>
      </div>`).join('');
  }

  /* ---------------- 消息详情 ---------------- */
  function openMessage(id) {
    const message = JD.messages.all().find((m) => m.id === id);
    if (!message) return;

    // 打开即标记为已读
    if (!message.read) {
      JD.messages.markRead(id);
      render();
    }

    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `
      <div class="modal-mask" data-close></div>
      <div class="msg-panel" role="dialog" aria-modal="true" aria-labelledby="msgTitle">
        <button class="modal-close" type="button" data-close aria-label="关闭">✕</button>
        <div class="msg-panel-head">
          <span class="msg-icon" aria-hidden="true">${ICON[message.cat] || '🔔'}</span>
          <div>
            <h3 id="msgTitle">${esc(message.title)}</h3>
            <p class="msg-panel-meta">${esc(CAT_NAME[message.cat] || '消息')} · ${esc(message.time)}</p>
          </div>
        </div>
        <p class="msg-panel-text">${esc(message.text)}</p>
        <div class="msg-panel-actions">
          ${message.cat === 'logistics' ? '<a class="btn btn-ghost" href="orders.html">查看订单</a>' : ''}
          <button type="button" class="btn btn-ghost" data-delete>删除消息</button>
          <button type="button" class="btn btn-primary" data-close>知道了</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const close = () => {
      JD.closeLayer(el);
      el.remove();
    };

    el.addEventListener('click', (event) => {
      if (event.target.closest('[data-delete]')) {
        close();
        deleteMessage(id);
        return;
      }
      if (event.target.closest('[data-close]')) close();
    });

    JD.registerLayer(el, close);
  }

  function deleteMessage(id) {
    const list = JD.messages.all();
    const index = list.findIndex((m) => m.id === id);
    if (index < 0) return;

    const [removed] = list.splice(index, 1);
    JD.messages.save(list);
    JD.updateBadges();
    render();

    JD.toast('消息已删除', {
      actionText: '撤销',
      duration: 5000,
      onAction: () => {
        const back = JD.messages.all();
        back.splice(Math.min(index, back.length), 0, removed);
        JD.messages.save(back);
        JD.updateBadges();
        render();
        JD.toast('已恢复消息');
      },
    });
  }

  function render() {
    renderTabs();
    renderList();
    JD.updateBadges();

    const readAll = document.getElementById('readAll');
    if (readAll) readAll.disabled = JD.messages.unreadCount() === 0;
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();

    const list = document.getElementById('msgList');
    if (list) {
      list.addEventListener('click', (event) => {
        const item = event.target.closest('[data-id]');
        if (item) openMessage(item.dataset.id);
      });
      list.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const item = event.target.closest('[data-id]');
        if (item) {
          event.preventDefault();
          openMessage(item.dataset.id);
        }
      });
    }

    const readAll = document.getElementById('readAll');
    if (readAll) {
      readAll.addEventListener('click', () => {
        if (!JD.messages.unreadCount()) return;
        JD.messages.markAllRead();
        render();
        JD.toast('已全部标为已读');
      });
    }
  });
})();
