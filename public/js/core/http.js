import { showLoading, hideLoading } from './ui.js';

export async function api(path, opts = {}) {
  const o = { headers: {}, ...opts };
  if (o.body && typeof o.body !== 'string') {
    o.headers['Content-Type'] = 'application/json';
    o.body = JSON.stringify(o.body);
  }
  showLoading();
  try {
    const res = await fetch('/api' + path, o);
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
