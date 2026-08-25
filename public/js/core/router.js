import { S } from './state.js';
import { enhance } from './controls.js';

const routes = new Map();

export function registerRoute(name, def) {
  routes.set(name, def);
}

export function navLinks() {
  const out = [];
  for (const [name, def] of routes) {
    if (!def.hidden && (!def.access || def.access(S.perms))) out.push([name, def]);
  }
  return out;
}

export function currentPath() {
  return (location.hash || '').replace(/^#\/?/, '');
}

export function navigate(path) {
  location.hash = '#/' + path;
}

export function applyRouter() {
  const view = document.getElementById('view');
  if (!view || !S.me) return false;
  let p = currentPath();
  const parts = p.split('/').filter(Boolean);
  const name = parts[0] || 'dashboard';
  const def = routes.get(name);
  if (!def || (def.access && !def.access(S.perms))) {
    navigate('dashboard');
    return false;
  }
  const canonical = '#/' + name + (parts.length > 1 ? '/' + parts.slice(1).join('/') : '');
  if (location.hash !== canonical) history.replaceState(null, '', canonical);
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  Promise.resolve(def.render(view, parts.slice(1)))
    .then(() => enhance(view))
    .catch(e => {
      import('./ui.js').then(({ toast }) => toast(e.message, 'err'));
    });
  return true;
}
