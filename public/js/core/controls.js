const registry = new Set();
const POP_Z = 600;

function hideOthers(exceptEl) {
  for (const w of [...registry]) {
    if (!w.covers(exceptEl)) w.hide();
  }
}

document.addEventListener('pointerdown', e => {
  for (const w of [...registry]) {
    if (!w.covers(e.target)) w.hide();
  }
}, true);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') for (const w of [...registry]) w.hide();
});

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---- fixed-position placement (escapes modal overflow clipping) ---- */
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

function makeWidget(hostEl, pop, anchorBtn) {
  const w = {
    el: hostEl,
    covers(t) { return hostEl.contains(t) || pop.contains(t); },
    _timer: null,
    show() {
      pop.hidden = false;
      pop.style.zIndex = POP_Z;
      if (!pop.parentNode || pop.parentNode !== document.body) document.body.appendChild(pop);
      placeFixed(pop, anchorBtn);
      anchorBtn.classList.add('open');
      registry.add(w);
      const h = () => {
        if (w._timer) return;
        w._timer = requestAnimationFrame(() => {
          w._timer = null;
          if (!pop.hidden) placeFixed(pop, anchorBtn);
        });
      };
      window.addEventListener('scroll', h, true);
      window.addEventListener('resize', h);
      w._h = h;
    },
    hide() {
      pop.hidden = true;
      if (w._h) {
        window.removeEventListener('scroll', w._h, true);
        window.removeEventListener('resize', w._h);
        w._h = null;
      }
      if (w._timer) { cancelAnimationFrame(w._timer); w._timer = null; }
      anchorBtn.classList.remove('open');
      registry.delete(w);
    }
  };
  return w;
}

export function enhance(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('select:not([data-cs]):not([multiple])').forEach(upgradeSelect);
  root.querySelectorAll('input[type="date"]:not([data-cs]), input[type="datetime-local"]:not([data-cs])').forEach(upgradeDate);
}

function fireChange(el) {
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* Generic dropdown helper (user menu, etc.) */
export function attachDropdown(triggerBtn, popEl, hostEl) {
  const w = {
    el: hostEl || triggerBtn.parentNode,
    covers(t) { return w.el.contains(t); },
    hide() {
      popEl.hidden = true;
      triggerBtn.classList.remove('open');
      registry.delete(w);
    }
  };
  triggerBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!popEl.hidden) return w.hide();
    hideOthers(w.el);
    popEl.hidden = false;
    triggerBtn.classList.add('open');
    registry.add(w);
  });
  return w;
}

/* ---------- Custom dropdown ---------- */
function upgradeSelect(sel) {
  sel.dataset.cs = '1';

  const wrap = document.createElement('div');
  wrap.className = 'cs';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add('cs-src');
  sel.setAttribute('tabindex', '-1');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cs-btn';
  btn.innerHTML = '<span class="cs-label"></span><span class="cs-chev"><i class="fa-solid fa-chevron-down"></i></span>';
  wrap.appendChild(btn);

  const pop = document.createElement('div');
  pop.className = 'cs-pop';
  pop.hidden = true;

  const widget = makeWidget(wrap, pop, btn);

  const syncLabel = () => {
    const o = sel.selectedOptions && sel.selectedOptions[0];
    btn.querySelector('.cs-label').textContent = o ? o.textContent.trim() : '';
  };

  const buildItems = () => {
    let h = '';
    for (const node of sel.children) {
      if (node.tagName === 'OPTGROUP') {
        h += `<div class="cs-group">${esc(node.label)}</div>`;
        for (const o of node.children) h += optHtml(o);
      } else if (node.tagName === 'OPTION') {
        h += optHtml(node);
      }
    }
    function optHtml(o) {
      return `<div class="cs-opt${o.selected ? ' active' : ''}" data-v="${esc(o.value)}"><span>${esc(o.textContent)}</span>${o.selected ? '<i class="fa-solid fa-check"></i>' : ''}</div>`;
    }
    pop.innerHTML = h;
    pop.querySelectorAll('.cs-opt').forEach(el => {
      el.onclick = () => {
        if (String(sel.value) !== el.dataset.v) {
          sel.value = el.dataset.v;
          syncLabel();
          fireChange(sel);
        }
        widget.hide();
      };
    });
  };

  const open = () => {
    hideOthers(wrap);
    buildItems();
    pop.style.minWidth = Math.max(btn.offsetWidth, 130) + 'px';
    widget.show();
    const act = pop.querySelector('.cs-opt.active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  };

  btn.onclick = e => {
    e.stopPropagation();
    if (!pop.hidden) widget.hide(); else open();
  };
  btn.onkeydown = e => {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); if (pop.hidden) open(); }
  };
  syncLabel();
}

/* ---------- Custom date picker ---------- */
const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad2 = n => String(n).padStart(2, '0');

function upgradeDate(inp) {
  inp.dataset.cs = '1';

  const wrap = document.createElement('div');
  wrap.className = 'cdp';
  inp.parentNode.insertBefore(wrap, inp);
  wrap.appendChild(inp);

  const display = document.createElement('span');
  display.className = 'cdp-display';
  wrap.appendChild(display);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cdp-btn';
  btn.title = 'Chọn ngày';
  btn.innerHTML = '<i class="fa-regular fa-calendar"></i>';
  wrap.appendChild(btn);

  const pop = document.createElement('div');
  pop.className = 'cdp-pop';
  pop.hidden = true;

  const isDT = inp.type === 'datetime-local';
  const now = new Date();

  const readValue = () => {
    const v = inp.value || '';
    const d = v && v.length >= 10 ? v.slice(0, 10).split('-').map(Number) : null;
    return {
      y: d ? d[0] : now.getFullYear(),
      m: d ? d[1] : now.getMonth() + 1,
      d: d ? d[2] : now.getDate(),
      hh: isDT && v.length >= 16 ? Number(v.slice(11, 13)) : now.getHours(),
      mm: isDT && v.length >= 16 ? Number(v.slice(14, 16)) : 0
    };
  };

  let cur = readValue();

  const widget = makeWidget(wrap, pop, inp);

  const fmtDisplay = () => {
    if (!inp.value) return '';
    return `${pad2(cur.d)}/${pad2(cur.m)}/${cur.y}`;
  };

  const write = () => {
    inp.value = `${String(cur.y).padStart(4, '0')}-${pad2(cur.m)}-${pad2(cur.d)}` +
      (isDT ? `T${pad2(cur.hh)}:${pad2(cur.mm)}` : '');
    display.textContent = fmtDisplay();
    fireChange(inp);
  };

  display.textContent = fmtDisplay();

  const render = () => {
    const firstDow = (new Date(cur.y, cur.m - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(cur.y, cur.m, 0).getDate();
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
    const valStr = `${cur.y}-${pad2(cur.m)}-${pad2(cur.d)}`;

    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<button type="button" class="cdp-day blank" tabindex="-1"></button>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${cur.y}-${pad2(cur.m)}-${pad2(d)}`;
      cells += `<button type="button" class="cdp-day${ds === todayStr ? ' today' : ''}${ds === valStr ? ' sel' : ''}" data-d="${d}">${d}</button>`;
    }

    let timeHtml = '';
    if (isDT) {
      let hh = '', mm = '';
      for (let i = 0; i < 24; i++) hh += `<option value="${i}" ${i === cur.hh ? 'selected' : ''}>${pad2(i)}</option>`;
      for (let i = 0; i < 60; i += 5) mm += `<option value="${i}" ${i === cur.mm ? 'selected' : ''}>${pad2(i)}</option>`;
      timeHtml = `<div class="cdp-time"><select class="cdp-hh">${hh}</select><select class="cdp-mm">${mm}</select></div>`;
    }

    pop.innerHTML = `
      <div class="cdp-head">
        <button type="button" class="cdp-nav" data-nav="-1"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="cdp-title">${MONTHS[cur.m - 1]} ${cur.y}</span>
        <button type="button" class="cdp-nav" data-nav="1"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="cdp-dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cdp-grid">${cells}</div>
      <div class="cdp-foot">
        <button type="button" class="btn sm secondary cdp-today"><i class="fa-solid fa-crosshairs"></i> Hôm nay</button>
        ${timeHtml}
      </div>`;

    pop.querySelectorAll('[data-nav]').forEach(b => {
      b.onclick = () => {
        cur.m += Number(b.dataset.nav);
        if (cur.m > 12) { cur.m = 1; cur.y++; }
        if (cur.m < 1) { cur.m = 12; cur.y--; }
        render();
      };
    });
    pop.querySelectorAll('.cdp-day[data-d]').forEach(b => {
      b.onclick = () => {
        cur.d = Number(b.dataset.d);
        write();
        if (!isDT) widget.hide(); else render();
      };
    });
    pop.querySelector('.cdp-today').onclick = () => {
      const n = new Date();
      cur.y = n.getFullYear(); cur.m = n.getMonth() + 1; cur.d = n.getDate();
      write();
      widget.hide();
    };
    if (isDT) {
      const hs = pop.querySelector('.cdp-hh');
      const ms = pop.querySelector('.cdp-mm');
      hs.onchange = () => { cur.hh = Number(hs.value); write(); };
      ms.onchange = () => { cur.mm = Number(ms.value); write(); };
      upgradeSelect(hs);
      upgradeSelect(ms);
    }
  };

  const open = () => {
    hideOthers(wrap);
    cur = readValue();
    render();
    widget.show();
  };

  btn.onclick = e => { e.stopPropagation(); if (!pop.hidden) widget.hide(); else open(); };
  inp.addEventListener('click', () => { if (pop.hidden) open(); });
  inp.addEventListener('focus', () => { if (pop.hidden) open(); });
}
