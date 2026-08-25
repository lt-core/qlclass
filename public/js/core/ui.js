import { escapeHtml, mdToHtml } from './md.js';
import { enhance } from './controls.js';

export const esc = escapeHtml;
export { mdToHtml };

export function renderContent(src) {
  if (!src || !src.trim()) return '';
  const s = src.trim();
  const looksHtml = /<[a-z][\s\S]*>/i.test(s);
  return looksHtml ? s : mdToHtml(s);
}

let _loadingCount = 0;
let _loadingEl = null;

function _ensureLoader() {
  if (_loadingEl) return;
  _loadingEl = document.createElement('div');
  _loadingEl.id = 'global-loading';
  _loadingEl.innerHTML = '<div class="loading-spinner"></div>';
  _loadingEl.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(255,255,255,.45);backdrop-filter:blur(2px);justify-content:center;align-items:center;pointer-events:all';
  document.body.appendChild(_loadingEl);
}

export function showLoading() {
  _ensureLoader();
  _loadingCount++;
  if (_loadingCount === 1) _loadingEl.style.display = 'flex';
}

export function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0 && _loadingEl) _loadingEl.style.display = 'none';
}

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

export function scoreBar(base, achievement, violation) {
  const b = Math.max(0, base || 0);
  const a = Math.max(0, achievement || 0);
  const v = Math.max(0, violation || 0);
  const total = b + a - v;
  const max = b + a;
  const basePct = max > 0 ? (b * 100 / max) : 100;
  const achPct = max > 0 ? (a * 100 / max) : 0;
  const vioPct = max > 0 ? (v * 100 / max) : 0;
  const baseW = Math.min(100, basePct);
  const achW = Math.min(100 - baseW, achPct);
  const vioW = Math.min(100 - baseW - achW, vioPct);
  const restW = Math.max(0, 100 - baseW - achW - vioW);
  return `<div class="score-bar-wrap">
    <div class="score-bar">
      <div class="sb-base" style="width:${baseW}%"></div>
      ${a > 0 ? `<div class="sb-ach" style="width:${achW}%"></div>` : ''}
      ${v > 0 ? `<div class="sb-vio" style="width:${vioW}%"></div>` : ''}
      ${restW > 0 ? `<div class="sb-empty" style="width:${restW}%"></div>` : ''}
    </div>
    <div class="score-bar-label">
      <span class="sb-lbl-base">${total}</span>
      ${a > 0 ? `<span class="sb-lbl-ach">+${a}</span>` : ''}
      ${v > 0 ? `<span class="sb-lbl-vio">-${v}</span>` : ''}
    </div>
  </div>`;
}
