import { api } from '../core/http.js';
import { esc, toast, confirmDlg, fmtDateTime } from '../core/ui.js';

export function renderPendingSection(el, pending, refresh) {
  const bulk = async (status, label) => {
    if (!(await confirmDlg(label + '?'))) return;
    try {
      const r = await api('/records/batch/status', { method: 'PUT', body: { ids: pending.map(x => x.id), status } });
      toast(`${r.updated} ghi nhận ${status === 'approved' ? 'đã duyệt' : 'đã từ chối'}`, 'ok');
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
  el.innerHTML = `
    <div class="card" style="border-left:4px solid var(--amber);margin-bottom:18px">
      <h3><i class="fa-solid fa-hourglass-half"></i> Chờ duyệt (${pending.length}) <span class="muted" style="margin-left:auto;font-weight:400;font-size:12.5px">Gửi từ tổ trưởng</span></h3>
      ${pending.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn sm green" id="ap-all"><i class="fa-solid fa-check-double"></i> Duyệt tất cả (${pending.length})</button>
        <button class="btn sm amber" id="rj-all"><i class="fa-solid fa-ban"></i> Từ chối tất cả (${pending.length})</button>
      </div>` : ''}
      <table class="tbl"><thead><tr><th>Thời gian</th><th>Học sinh</th><th>Loại</th><th>Ghi chú</th><th>Người gửi</th><th></th></tr></thead>
      <tbody>${pending.map(r => `<tr>
        <td>${fmtDateTime(r.createdAt)}</td>
        <td><b>${esc(r.studentName)}</b><br><span class="muted">${esc(r.groupName)}</span></td>
        <td>${r.kind === 'achievement' ? '<span class="tag green">+</span>' : '<span class="tag red">−</span>'} ${esc(r.typeName)} (${r.typePoints})</td>
        <td>${esc(r.note || '')}</td>
        <td class="muted">${esc(r.createdByName || '')}</td>
        <td class="actions">
          <button class="btn sm green" data-approve="${r.id}">Duyệt</button>
          <button class="btn sm amber" data-reject="${r.id}">Từ chối</button>
          <button class="btn sm red" data-delrec="${r.id}">Xóa</button>
        </td></tr>`).join('')}</tbody></table>
    </div>`;
  el.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => setStatus(b.dataset.approve, 'approved'));
  el.querySelectorAll('[data-reject]').forEach(b => b.onclick = () => setStatus(b.dataset.reject, 'rejected'));
  el.querySelectorAll('[data-delrec]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa ghi nhận này?')) {
      try { await api('/records/' + b.dataset.delrec, { method: 'DELETE' }); toast('Đã xóa', 'ok'); refresh(); } catch (e) { toast(e.message, 'err'); }
    }
  });
  const apAll = el.querySelector('#ap-all');
  const rjAll = el.querySelector('#rj-all');
  if (apAll) apAll.onclick = () => bulk('approved', 'Duyệt tất cả');
  if (rjAll) rjAll.onclick = () => bulk('rejected', 'Từ chối tất cả');
  async function setStatus(id, status) {
    try {
      await api(`/records/${id}/status`, { method: 'PUT', body: { status } });
      toast(status === 'approved' ? 'Đã duyệt' : 'Đã từ chối', 'ok');
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  }
}