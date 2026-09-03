import { showLoading, hideLoading } from './ui.js';

const NEUTRAL = /^\/(auth|classes|current-class|settings|types|users|upload)/;

export async function api(path, opts = {}) {
  const o = { headers: {}, ...opts };
  if (o.body && typeof o.body !== 'string') {
    o.headers['Content-Type'] = 'application/json';
    o.body = JSON.stringify(o.body);
  }
  let finalPath = path;
  try {
    const { S } = await import('./state.js');
    const cid = S && S.currentClassId != null ? Number(S.currentClassId) : null;
    if (cid != null && !NEUTRAL.test(path)) {
      finalPath = path + (path.includes('?') ? '&' : '?') + 'classId=' + cid;
    }
  } catch (_) {}
  showLoading();
  try {
    const res = await fetch('/api' + finalPath, o);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const msg = (data && data.error) || ('Lỗi ' + res.status);
      if (res.status === 401) {
        const { forceLogin } = await import('../app.js');
        forceLogin();
      }
      throw new Error(msg);
    }
    return data;
  } finally {
    hideLoading();
  }
}
