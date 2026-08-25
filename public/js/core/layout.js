import { S, POS_LABEL } from './state.js';
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
      <div class="brand"><i class="fa-solid fa-graduation-cap"></i> QLClass<small>${esc(S.settings.className)} • KH ${esc(S.settings.schoolYear)}</small></div>
      <div class="spacer"></div>
      <div class="weekbox"><span>Tuần</span> <select id="week-sel">${weekOptions()}</select></div>
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
      ${links.map(([name, def]) => `<a href="#/${name}" data-route="${name}"><i class="fa-solid ${def.icon}"></i> ${def.title}<span id="badge-${name}"></span></a>`).join('')}
    </nav>
    <main id="view"></main>`;
  enhance(document.querySelector('.topbar'));
  const ubtn = document.getElementById('ubtn');
  const upop = document.getElementById('upop');
  if (ubtn && upop) attachDropdown(ubtn, upop, ubtn.parentNode);
  document.getElementById('btn-changepw').onclick = () => changePwModal();
  document.getElementById('btn-logout').onclick = async () => {
    const { api } = await import('./http.js');
    await api('/auth/logout', { method: 'POST' });
    forceLogin();
  };
  document.getElementById('week-sel').onchange = e => {
    S.week = Number(e.target.value);
    localStorage.setItem('qlc_week', String(S.week));
    applyRouter();
  };
}

function weekOptions() {
  let h = '';
  for (let i = 1; i <= (S.settings.weeks || 35); i++) {
    h += `<option value="${i}" ${i === S.week ? 'selected' : ''}>Tuần ${i}</option>`;
  }
  return h;
}

export function setBadge(routeName, n) {
  const b = document.getElementById('badge-' + routeName);
  if (b) b.innerHTML = n > 0 ? ` <span class="badge">${n}</span>` : '';
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
