import { S, POS_LABEL, WEEK_LABEL, SUMMARY_KEYS, weekDisplay } from './state.js';
import { esc, toast, openModal } from './ui.js';
import { navLinks, navigate, applyRouter } from './router.js';
import { enhance, attachDropdown } from './controls.js';

export function renderApp() {
  const initials = (S.me.name || S.me.username).split(/\s+/).map(w => w[0]).slice(-2).join('').toUpperCase();
  const roleLabel = S.me.role === 'admin' ? 'Quản trị viên' : S.me.role === 'teacher' ? 'Giáo viên' : esc(POS_LABEL[(S.student || {}).position] || 'Học sinh');
  const myPhoto = (S.student || {}).photo || '';
  const avHtml = cls => myPhoto
    ? `<span class="avatar ${cls}"><img src="${esc(myPhoto)}" alt=""></span>`
    : `<span class="avatar ${cls}">${esc(initials)}</span>`;
  const links = navLinks();
  document.getElementById('app').innerHTML = `
    <div class="topbar">
      <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
      <div class="brand"><i class="fa-solid fa-graduation-cap"></i><span class="brand-name">QLClass</span><small>${esc(S.settings.className)} • KH ${esc(S.settings.schoolYear)}</small></div>
      <div class="spacer"></div>
      <div class="weekbox"><span>Tuần</span><select id="week-sel">${weekOptions()}</select></div>
      <div class="udrop bell-wrap">
        <button type="button" class="ubtn" id="bell-btn" title="Thông báo" aria-label="Thông báo">
          <span class="bell-ic"><i class="fa-regular fa-bell"></i><span class="bell-badge" id="bell-badge" hidden></span></span>
        </button>
        <div class="upop bell-pop" id="bell-pop" hidden></div>
      </div>
      <div class="userbox">
        <div class="uinfo"><b>${esc(S.me.name)}</b><span>${roleLabel}</span></div>
        <div class="udrop">
          <button type="button" class="ubtn" id="ubtn" title="Tài khoản">
            ${avHtml('')}
            <i class="fa-solid fa-chevron-down ucaret"></i>
          </button>
          <div class="upop" id="upop" hidden>
            <div class="upop-head">
              ${avHtml('lg')}
              <div class="upop-id"><b>${esc(S.me.name)}</b><small>${roleLabel}</small></div>
            </div>
            <div class="upop-meta">
              <span><i class="fa-solid fa-school"></i> Lớp ${esc(S.settings.className)}</span>
              <span><i class="fa-solid fa-calendar-days"></i> Năm học ${esc(S.settings.schoolYear)}</span>
            </div>
            <div class="upop-sep"></div>
            <button class="btn secondary" style="width:100%;margin-bottom:8px" id="btn-changepw"><i class="fa-solid fa-user-lock"></i> Đổi mật khẩu</button>
            <button class="btn red" style="width:100%" id="btn-logout"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
          </div>
        </div>
      </div>
    </div>
    <nav class="nav">
      <div class="nav-brand"><i class="fa-solid fa-graduation-cap"></i><b style="line-height:1.25"><span style="display:block">QLClass</span><small>${esc(S.settings.className)} • KH ${esc(S.settings.schoolYear)}</small></b></div>
      ${links.map(([name, def]) => `<a href="#/${name}" data-route="${name}"><i class="fa-solid ${def.icon}"></i> ${def.title}<span id="badge-${name}"></span></a>`).join('')}
    </nav>
    <main id="view"></main>`;
  enhance(document.querySelector('.topbar'));
  const ubtn = document.getElementById('ubtn');
  const upop = document.getElementById('upop');
  if (ubtn && upop) attachDropdown(ubtn, upop, ubtn.parentNode);
  const bellBtn = document.getElementById('bell-btn');
  const bellPop = document.getElementById('bell-pop');
  if (bellBtn && bellPop) {
    attachDropdown(bellBtn, bellPop, bellBtn.parentNode);
    bellBtn.addEventListener('click', () => { if (!bellPop.hidden) openBellPop(); });
  }
  refreshNotifs();
  document.getElementById('btn-changepw').onclick = () => changePwModal();
  document.getElementById('btn-logout').onclick = async () => {
    const { api } = await import('./http.js');
    await api('/auth/logout', { method: 'POST' });
    forceLogin();
  };
  document.getElementById('week-sel').onchange = e => {
    const v = e.target.value;
    const num = Number(v);
    S.week = isNaN(num) ? v : num;
    localStorage.setItem('qlc_week', String(S.week));
    applyRouter();
  };
  wireNavDrawer();
}

function wireNavDrawer() {
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('nav-toggle');
  if (!nav || !toggle) return;
  let backdrop = document.getElementById('nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.id = 'nav-backdrop';
    backdrop.addEventListener('click', closeNavDrawer);
    document.body.appendChild(backdrop);
  }
  toggle.onclick = () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  };
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNavDrawer));
  if (!document.body.dataset.navKeys) {
    document.body.dataset.navKeys = '1';
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeNavDrawer();
    });
  }
}

function closeNavDrawer() {
  document.body.classList.remove('nav-open');
  const toggle = document.getElementById('nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function weekOptions() {
  const total = S.settings.weeks || 36;
  const semLen = Math.floor(total / 2);
  const sel = String(S.week);
  let h = `<option value="0" ${sel === '0' ? 'selected' : ''}>Tuần 0 (Chuẩn bị)</option>`;
  h += `<optgroup label="--- Hoc ky I ---">`;
  for (let i = 1; i <= semLen; i++) {
    h += `<option value="${i}" ${sel === String(i) ? 'selected' : ''}>Tuần ${i}</option>`;
    if (i === Math.floor(semLen / 2)) h += `<option value="s1mid" ${sel === 's1mid' ? 'selected' : ''}>${WEEK_LABEL.s1mid} (0-${Math.floor(semLen / 2)})</option>`;
  }
  h += `<option value="s1end" ${sel === 's1end' ? 'selected' : ''}>${WEEK_LABEL.s1end} (0-${semLen})</option>`;
  h += `</optgroup>`;
  h += `<optgroup label="--- Hoc ky II ---">`;
  for (let i = semLen + 1; i <= total; i++) {
    h += `<option value="${i}" ${sel === String(i) ? 'selected' : ''}>Tuần ${i}</option>`;
    if (i === semLen + Math.floor(semLen / 2)) h += `<option value="s2mid" ${sel === 's2mid' ? 'selected' : ''}>${WEEK_LABEL.s2mid} (${semLen + 1}-${semLen + Math.floor(semLen / 2)})</option>`;
  }
  h += `<option value="s2end" ${sel === 's2end' ? 'selected' : ''}>${WEEK_LABEL.s2end} (${semLen + 1}-${total})</option>`;
  h += `</optgroup>`;
  h += `<optgroup label="---">`;
  h += `<option value="year" ${sel === 'year' ? 'selected' : ''}>${WEEK_LABEL.year} (0-${total})</option>`;
  h += `</optgroup>`;
  return h;
}

export function setBadge(routeName, n) {
  const b = document.getElementById('badge-' + routeName);
  if (b) b.innerHTML = n > 0 ? ` <span class="badge">${n}</span>` : '';
}

async function fetchAnns() {
  try {
    const res = await fetch('/api/announcements');
    const data = await res.json();
    if (!res.ok) throw new Error((data && data.error) || res.status);
    return data;
  } catch (_) { return []; }
}

function annSnippet(a) {
  const txt = String(a.content || '').replace(/[#*_>`-]/g, ' ').replace(/\s+/g, ' ').trim();
  return txt ? txt : (a.expiresAt ? 'Bấm để xem chi tiết' : 'Thông báo từ ban cán sự');
}

function annTimeAgo(iso) {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'Vừa xong';
  if (s < 3600) return Math.floor(s / 60) + ' phút trước';
  if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
  if (s < 604800) return Math.floor(s / 86400) + ' ngày trước';
  return new Date(iso).toLocaleDateString('vi-VN');
}

async function refreshNotifs() {
  const list = await fetchAnns();
  const n = list.length;
  setBadge('announcements', n);
  const badge = document.getElementById('bell-badge');
  if (badge) {
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
  }
  const bell = document.getElementById('bell-btn');
  if (bell) bell.hidden = n === 0;
  return list;
}

export function markAnnSeen() {
  refreshNotifs();
}

async function openBellPop() {
  const pop = document.getElementById('bell-pop');
  pop.innerHTML = '<div class="bell-head"><b><i class="fa-regular fa-bell"></i> Thông báo</b></div><div class="bell-empty"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';
  const list = await refreshNotifs();
  pop.innerHTML = `
    <div class="bell-head"><b><i class="fa-regular fa-bell"></i> Thông báo</b>${list.length ? `<span class="bell-total">${list.length} thông báo</span>` : ''}</div>
    <div class="bell-list">${list.length ? list.map(a => `
      <button type="button" class="bell-item" data-ann="${a.id}">
        <span class="bell-title">${esc(a.title)}</span>
        <span class="bell-snippet">${esc(annSnippet(a))}</span>
        <span class="bell-time">${esc(a.createdBy || '')}${a.createdBy ? ' • ' : ''}${annTimeAgo(a.createdAt)}</span>
      </button>`).join('') : '<div class="bell-empty">Chưa có thông báo nào</div>'}</div>
    <div class="bell-foot"><button class="btn sm secondary" id="bell-all" style="width:100%"><i class="fa-solid fa-bullhorn"></i> Xem tất cả thông báo</button></div>`;
  const close = () => { const b = document.getElementById('bell-btn'); if (b && !document.getElementById('bell-pop').hidden) b.click(); };
  const goAll = () => { close(); navigate('announcements'); };
  pop.querySelectorAll('.bell-item').forEach(it => it.onclick = goAll);
  pop.querySelector('#bell-all').onclick = goAll;
}

export function forceLogin() {
  import('../login.js').then(m => m.renderLogin());
}

function changePwModal() {
  const m = openModal({
    title: 'Đổi mật khẩu',
    body: `
      <label class="f">Mật khẩu hiện tại</label><input type="password" id="pw-old" autocomplete="current-password">
      <label class="f">Mật khẩu mới (tối thiểu 4 ký tự)</label><input type="password" id="pw-new" autocomplete="new-password">
      <label class="f">Nhập lại mật khẩu mới</label><input type="password" id="pw-new2" autocomplete="new-password">
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn secondary" id="pw-cancel">Hủy</button>
        <button class="btn" id="pw-save">Lưu mật khẩu</button></div>`
  });
  m.el.querySelector('#pw-cancel').onclick = m.close;
  m.el.querySelector('#pw-save').onclick = async () => {
    const oldP = m.el.querySelector('#pw-old').value;
    const newP = m.el.querySelector('#pw-new').value;
    const newP2 = m.el.querySelector('#pw-new2').value;
    if (newP.length < 4) return toast('Mật khẩu mới tối thiểu 4 ký tự', 'err');
    if (newP !== newP2) return toast('Nhập lại mật khẩu không khớp', 'err');
    try {
      const { api: apiFn } = await import('./http.js');
      await apiFn('/auth/change-password', { method: 'POST', body: { oldPassword: oldP, newPassword: newP } });
      m.close();
      toast('Đã đổi mật khẩu thành công', 'ok');
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}
