import './common/dashboard.js';
import './common/records.js';
import './common/reviews.js';
import './common/life.js';
import './common/treasury.js';
import './common/announcements.js';
import './teacher/classroom.js';
import './admin/admin.js';

import { S, loadBootstrap } from './core/state.js';
import { applyRouter, navigate } from './core/router.js';
import { renderApp } from './core/layout.js';
import { renderLogin } from './login.js';
import { renderHome } from './home.js';

const BUILD = '20260827o';
console.log('[QLClass] build ' + BUILD);
document.title = 'QLClass — Quản lý lớp học (' + BUILD + ')';

export function forceLogin() {
  renderHome();
}

export function enterApp() {
  renderApp();
  const before = location.hash;
  navigate('dashboard');
  if (location.hash === before) applyRouter();
}

window.addEventListener('hashchange', () => {
  S.selSid = null;
  applyRouter();
});

(async function boot() {
  try {
    await loadBootstrap();
    enterApp();
  } catch (_) {
    renderHome();
  }
})();
