import { esc } from './ui.js';

/* Reusable custom date field: a text input (auto-slash dd/mm/yyyy) that you can
   type into, plus a picker button opening a calendar popup (position:fixed so it
   escapes modal overflow clipping). */
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad2 = n => String(n).padStart(2, '0');

export function todayDDMMYYYY() {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* Parse dd/mm/yyyy -> YYYY-MM-DD (for the server), or null if invalid/empty. */
export function parseDateInput(val) {
  const raw = String(val || '').trim();
  if (!raw) return '';
  const mm = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!mm) return null;
  const dd = Number(mm[1]), mo = Number(mm[2]), yy = Number(mm[3]);
  if (!(dd >= 1 && dd <= 31 && mo >= 1 && mo <= 12)) return null;
  return `${yy}-${pad2(mo)}-${pad2(dd)}`;
}

export function dateFieldHTML(opts = {}) {
  return `<span class="date-field" data-date-field>
    <input type="text" class="df-input" inputmode="numeric" placeholder="dd/mm/yyyy" maxlength="10" value="${esc(opts.value || '')}">
    <button type="button" class="df-btn" title="Chọn ngày"><i class="fa-solid fa-calendar-days"></i></button>
  </span>`;
}

/* Position a popup below the anchor, flipping/clamping so it stays on-screen. */
function placeFixed(pop, anchor) {
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = r.left;
  if (left + pw > window.innerWidth - 8) left = Math.max(8, r.right - pw);
  let top = r.bottom + 5;
  if (top + ph > window.innerHeight - 8) {
    const above = r.top - ph - 5;
    top = above >= 8 ? above : Math.max(8, window.innerHeight - ph - 8);
  }
  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(top) + 'px';
}

export function mountDateField(root) {
  const input = root.querySelector('.df-input');
  const btn = root.querySelector('.df-btn');

  const fmtSlash = v => {
    let s = v.replace(/[^\d]/g, '').slice(0, 8);
    if (s.length > 4) s = s.slice(0, 2) + '/' + s.slice(2, 4) + '/' + s.slice(4);
    else if (s.length > 2) s = s.slice(0, 2) + '/' + s.slice(2);
    return s;
  };
  input.addEventListener('input', () => { input.value = fmtSlash(input.value); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && input.value.endsWith('/')) {
      e.preventDefault();
      input.value = fmtSlash(input.value.slice(0, -1));
    }
  });

  const popup = document.createElement('div');
  popup.className = 'df-pop';
  popup.hidden = true;
  document.body.appendChild(popup);

  let curY, curM, curD;
  const readCur = () => {
    const mm = input.value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    const now = new Date();
    return {
      y: mm ? Number(mm[3]) : now.getFullYear(),
      m: mm ? Number(mm[2]) : now.getMonth() + 1,
      d: mm ? Number(mm[1]) : now.getDate()
    };
  };

  const render = () => {
    const t = new Date();
    const todayStr = `${pad2(t.getDate())}/${pad2(t.getMonth() + 1)}/${t.getFullYear()}`;
    const valStr = `${pad2(curD)}/${pad2(curM)}/${curY}`;
    const firstDow = (new Date(curY, curM - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(curY, curM, 0).getDate();

    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<button type="button" class="df-day blank" tabindex="-1"></button>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${pad2(d)}/${pad2(curM)}/${curY}`;
      cells += `<button type="button" class="df-day${ds === todayStr ? ' today' : ''}${ds === valStr ? ' sel' : ''}" data-d="${d}">${d}</button>`;
    }
    popup.innerHTML = `
      <div class="df-head">
        <button type="button" class="df-nav" data-nav="-1"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="df-title">${MONTHS[curM - 1]} ${curY}</span>
        <button type="button" class="df-nav" data-nav="1"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="df-dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="df-grid">${cells}</div>
      <div class="df-foot">
        <button type="button" class="btn sm secondary df-today"><i class="fa-solid fa-crosshairs"></i> Hôm nay</button>
      </div>`;
    popup.querySelectorAll('.df-nav').forEach(b => {
      b.onclick = () => { curM += Number(b.dataset.nav); if (curM > 12) { curM = 1; curY++; } if (curM < 1) { curM = 12; curY--; } render(); };
    });
    popup.querySelectorAll('.df-day[data-d]').forEach(b => {
      b.onclick = () => {
        curD = Number(b.dataset.d);
        input.value = `${pad2(curD)}/${pad2(curM)}/${curY}`;
        close();
      };
    });
    popup.querySelector('.df-today').onclick = () => {
      const n = new Date();
      curY = n.getFullYear(); curM = n.getMonth() + 1; curD = n.getDate();
      input.value = todayDDMMYYYY();
      close();
    };
  };

  const open = () => {
    const c = readCur(); curY = c.y; curM = c.m; curD = c.d;
    render();
    popup.hidden = false;
    popup.style.position = 'fixed';
    popup.style.zIndex = '99990';
    window.requestAnimationFrame(() => placeFixed(popup, input));
  };
  const close = () => { popup.hidden = true; };

  btn.addEventListener('click', e => { e.stopPropagation(); if (popup.hidden) open(); else close(); });
  input.addEventListener('click', e => { e.stopPropagation(); if (popup.hidden) open(); });

  document.addEventListener('pointerdown', e => { if (!input.contains(e.target) && !popup.contains(e.target)) close(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', () => { if (!popup.hidden) placeFixed(popup, input); }, true);
  window.addEventListener('resize', () => { if (!popup.hidden) placeFixed(popup, input); });

  return {
    input,
    parse: () => parseDateInput(input.value),
    set: v => { input.value = v || ''; }
  };
}
