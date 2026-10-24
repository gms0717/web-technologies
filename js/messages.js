/* =========================================================
   messages.js — 消息页
   分类筛选 / 未读标记 / 全部标为已读
   ========================================================= */
(function () {
  'use strict';

  const { esc } = JD;
  const ICON = { logistics: '📦', promo: '🎁', system: '📢' };

  let active = 'all';

  const unreadOf = (cat) =>
    JD.messages.all().filter((m) => (cat === 'all' || m.cat === cat) && !m.read).length;

  function renderTabs() {
    const host = document.getElementById('msgTabs');
    if (!host) return;

    host.innerHTML = JD.messageCats.map((cat) => {
      const n = unreadOf(cat.id);
      return `<button type="button" class="tab${active === cat.id ? ' is-active' : ''}" data-cat="${cat.id}">
                ${esc(cat.name)}${n ? `（${n}）` : ''}
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

    const list = JD.messages.all().filter((m) => active === 'all' || m.cat === active);

    if (!list.length) {
      host.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <p>暂无消息</p>
        </div>`;
      return;
    }

    host.innerHTML = list.map((m) => `
      <div class="msg-item" data-id="${m.id}" role="button" tabindex="0" aria-label="查看消息 ${esc(m.title)}">
        <span class="msg-icon" aria-hidden="true">${ICON[m.cat] || '🔔'}</span>
        <div class="msg-body">
          <p class="msg-title">${esc(m.title)}${m.read ? '' : '<span class="dot" aria-label="未读"></span>'}</p>
          <p class="msg-text">${esc(m.text)}</p>
        </div>
        <span class="msg-time">${esc(m.time)}</span>
      </div>`).join('');

    host.querySelectorAll('.msg-item').forEach((item) => {
      const open = () => {
        const target = JD.messages.all().find((m) => m.id === item.dataset.id);
        if (target && !target.read) {
          JD.messages.markRead(item.dataset.id);
          render();
        }
      };
      item.addEventListener('click', open);
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function render() {
    renderTabs();
    renderList();
    JD.updateBadges();
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();

    const readAll = document.getElementById('readAll');
    if (readAll) {
      readAll.addEventListener('click', () => {
        if (!JD.messages.unreadCount()) {
          JD.toast('没有未读消息了');
          return;
        }
        JD.messages.markAllRead();
        render();
        JD.toast('已全部标为已读');
      });
    }
  });
})();
