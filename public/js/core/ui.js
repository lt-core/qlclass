import { escapeHtml, mdToHtml } from './md.js';
import { enhance } from './controls.js';

export const esc = escapeHtml;
export { mdToHtml };

export function toast(msg, type) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

export function openModal({ title, body, wide }) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal${wide ? ' wide' : ''}"><header><span>${title}</span><span class="x" title="Đóng">×</span></header><div class="body">${body}</div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.x').onclick = close;
  enhance(ov);
  return { el: ov, close };
}

export function confirmDlg(msg) {
  return new Promise(resolve => {
    const m = openModal({
      title: 'Xác nhận',
      body: `<p style="margin-bottom:14px">${esc(msg)}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn secondary" id="cf-no">Hủy</button>
        <button class="btn red" id="cf-yes">Xác nhận</button></div>`
    });
    m.el.querySelector('#cf-no').onclick = () => { m.close(); resolve(false); };
    m.el.querySelector('#cf-yes').onclick = () => { m.close(); resolve(true); };
  });
}

export function fmtDate(d) {
  if (!d) return '';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function money(n) { return Number(n || 0).toLocaleString('vi-VN') + '₫'; }

export function todayStr() { return new Date().toISOString().slice(0, 10); }

export function barHtml(value, max, warnBelow = 0) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100 / (max || 1)));
  return `<div class="bar"><div class="${value < warnBelow ? 'warn' : ''}" style="width:${pct}%"></div></div>`;
}
