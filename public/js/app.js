import './common/dashboard.js';
import './common/records.js';
import './common/reviews.js';
import './common/life.js';
import './common/treasury.js';
import './common/announcements.js';
import './teacher/classroom.js';
import './admin/admin.js';

import { S, loadBootstrap, applyClassSettingsById, persistTeacherClass, teacherSavedClassId } from './core/state.js';
import { esc } from './core/ui.js';
import { applyRouter, navigate } from './core/router.js';
import { renderApp } from './core/layout.js';
import { renderLogin } from './login.js';
import { renderHome } from './home.js';

const BUILD = '20260827w';
console.log('[QLClass] build ' + BUILD);
document.title = 'QLClass — Quản lý lớp học (' + BUILD + ')';

export function forceLogin() {
  renderHome();
}

export async function enterApp() {
  const ok = await prepareActiveClass();
  if (!ok) return;
  renderApp();
  const before = location.hash;
  navigate('dashboard');
  if (location.hash === before) applyRouter();
}

async function applyAndRefresh(id) {
  applyClassSettingsById(id);
  persistTeacherClass(id);
  S.currentClassId = Number(id);
  await loadBootstrap();
}

async function prepareActiveClass() {
  if (S.me.role !== 'teacher') return true;
  const managed = (S.managedClassIds || []).map(Number);
  if (managed.length === 0) {
    renderNoClass();
    return false;
  }
  const saved = teacherSavedClassId();
  if (managed.indexOf(saved) > -1) {
    await applyAndRefresh(saved);
    return true;
  }
  if (managed.length === 1) {
    await applyAndRefresh(managed[0]);
    return true;
  }
  renderClassChooser(managed);
  return false;
}

function renderNoClass() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-school"></i></div>
      <h2>Chưa có lớp học</h2>
      <p>Bạn chưa được phân công quản lý lớp nào. Hãy liên hệ với quản trị viên để được gán lớp.</p>
      <button class="btn secondary" id="no-class-logout"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
    </div>`;
  document.getElementById('no-class-logout').onclick = () => {
    import('./core/http.js').then(({ api }) => api('/auth/logout', { method: 'POST' }))
      .finally(() => renderHome());
  };
}

function renderClassChooser(managedIds) {
  const managed = S.classes.filter(c => managedIds.includes(Number(c.id)));
  const app = document.getElementById('app');
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">
      <div style="max-width:520px;width:100%">
        <div class="card">
          <h3 style="margin-top:0"><i class="fa-solid fa-chalkboard-user"></i> Chọn lớp để quản lý</h3>
          <p class="page-sub" style="margin-top:0">Xin chào <b>${esc(S.me.name)}</b>, bạn quản lý <b>${managed.length}</b> lớp. Hãy chọn một lớp để vào làm việc.</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">
            ${managed.map(c => `
              <button class="btn class-chooser" data-class-id="${c.id}">
                <span style="flex:1;text-align:left">
                  <b>${esc(c.name)}</b>
                  <small style="display:block;opacity:.7">${esc(c.schoolYear)} • Khối ${c.grade}</small>
                </span>
                <i class="fa-solid fa-chevron-right"></i>
              </button>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px">
            <span class="muted">Đăng nhập dưới vai trò giáo viên</span>
            <button class="btn secondary" id="chooser-logout"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
          </div>
        </div>
      </div>
    </div>`;
  app.querySelectorAll('.class-chooser').forEach(b => b.onclick = async () => {
    const id = Number(b.dataset.classId);
    await applyAndRefresh(id);
    renderApp();
    const before = location.hash;
    navigate('dashboard');
    if (location.hash === before) applyRouter();
  });
  document.getElementById('chooser-logout').onclick = () => {
    import('./core/http.js').then(({ api }) => api('/auth/logout', { method: 'POST' }))
      .finally(() => renderHome());
  };
}

window.addEventListener('hashchange', () => {
  S.selSid = null;
  applyRouter();
});

(async function boot() {
  try {
    await loadBootstrap();
    await enterApp();
  } catch (_) {
    renderHome();
  }
})();
