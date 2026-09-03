import { api } from './core/http.js';
import { S, loadBootstrap, positionsOfUser, setActivePosition, POS_LABEL } from './core/state.js';
import { esc } from './core/ui.js';

function renderRoleChooser() {
  const list = positionsOfUser();
  const meaningful = list.filter(p => p !== 'thanh_vien');
  if (meaningful.length < 2) return null;
  document.getElementById('app').innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <h1><i class="fa-solid fa-id-badge"></i> Chọn chức vụ</h1>
      <div class="sub">Bạn đang giữ ${list.length} chức vụ. Chọn chức vụ để quản lý:</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
        ${list.map(p => `<button class="btn role-cho" data-role="${p}" style="width:100%;justify-content:center">
          <i class="fa-solid fa-${p === S.activePosition ? 'circle-check' : 'circle'}"></i> ${esc(POS_LABEL[p] || p)}
        </button>`).join('')}
      </div>
      <div style="text-align:center;margin-top:14px"><a href="#" id="lg-home" style="font-size:13px;color:var(--primary);text-decoration:none"><i class="fa-solid fa-arrow-left"></i> Đăng nhập lại</a></div>
    </div></div>`;
  document.querySelectorAll('.role-cho').forEach(btn => {
    btn.onclick = async () => {
      setActivePosition(btn.dataset.role);
      const { enterApp } = await import('./app.js');
      enterApp();
    };
  });
  document.getElementById('lg-home').onclick = e => {
    e.preventDefault();
    import('./login.js').then(m => m.renderLogin());
  };
  return true;
}

export function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <h1><i class="fa-solid fa-graduation-cap"></i> QLClass</h1>
      <div class="sub">Ứng dụng quản lý lớp học</div>
      <label class="f">Tài khoản</label>
      <input type="text" id="lg-user" autocomplete="username">
      <label class="f">Mật khẩu</label>
      <input type="password" id="lg-pass" autocomplete="current-password">
      <div id="lg-err" style="color:var(--red);font-size:13px;margin-top:8px"></div>
      <button class="btn" id="lg-btn" style="width:100%;justify-content:center;margin-top:12px">Đăng nhập</button>
      <div style="text-align:center;margin-top:14px"><a href="#" id="lg-home" style="font-size:13px;color:var(--primary);text-decoration:none"><i class="fa-solid fa-arrow-left"></i> Về trang chủ</a></div>
    </div></div>`;
  document.getElementById('lg-home').onclick = e => {
    e.preventDefault();
    import('./home.js').then(m => m.renderHome());
  };
  const doLogin = async () => {
    const btn = document.getElementById('lg-btn');
    btn.disabled = true;
    try {
      await api('/auth/login', { method: 'POST', body: { username: document.getElementById('lg-user').value, password: document.getElementById('lg-pass').value } });
      await loadBootstrap();
      if (renderRoleChooser()) return;
      const { enterApp } = await import('./app.js');
      enterApp();
    } catch (e) {
      document.getElementById('lg-err').textContent = e.message;
    }
    btn.disabled = false;
  };
  document.getElementById('lg-btn').onclick = doLogin;
  ['lg-user', 'lg-pass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
}
