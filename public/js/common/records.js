import { api } from '../core/http.js';
import { S, weekDisplay } from '../core/state.js';
import { esc, toast, confirmDlg, fmtDateTime, scoreBar } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { setBadge } from '../core/layout.js';
import { renderPendingSection } from '../teacher/approvals.js';
import { renderSubmitButton } from '../student/record-submit.js';

async function render(view) {
  const [sum, sumAll, recs] = await Promise.all([
    api('/summary?week=' + S.week),
    api('/summary'),
    api('/records?week=' + S.week)
  ]);
  setBadge('records', S.perms.isTeacher ? (sumAll.pendingCount || 0) : 0);

  const row = r => `
    <tr>
      <td>${fmtDateTime(r.createdAt)}</td>
      <td><b>${esc(r.studentName)}</b><br><span class="muted">${esc(r.groupName)}</span></td>
      <td>${r.kind === 'achievement' ? '<span class="tag green">+</span>' : '<span class="tag red">−</span>'} ${esc(r.typeName)} (${r.kind === 'achievement' ? '+' : '-'}${r.typePoints})</td>
      <td>${esc(r.note || '')}</td>
      <td class="muted">${esc(r.createdByName || '')}</td>
      <td>${r.status === 'approved' ? '<span class="tag green">Đã duyệt</span>' : r.status === 'rejected' ? '<span class="tag gray">Từ chối</span>' : '<span class="tag amber">Chờ duyệt</span>'}</td>
      <td class="actions">
        ${!isSummary && S.perms.approveRecords && r.status === 'pending' ? `<button class="btn sm green" data-approve="${r.id}">Duyệt</button> <button class="btn sm amber" data-reject="${r.id}">Từ chối</button>` : ''}
        ${!isSummary && canDel(r) ? `<button class="btn sm red" data-delrec="${r.id}">Xóa</button>` : ''}
      </td>
    </tr>`;

  function canDel(r) {
    if (S.perms.approveRecords) return true;
    return r.createdByName === S.me.name && r.status === 'pending';
  }

  const pending = recs.filter(r => r.status === 'pending');
  const isSummary = typeof S.week === 'string';

  view.innerHTML = `
    <h2 class="page-title">Thành tích & Vi phạm — ${weekDisplay(S.week)}</h2>
    <p class="page-sub">${S.perms.isTeacher ? 'Duyệt hoặc từ chối các ghi nhận tổ trưởng gửi.' : S.perms.addRecords ? 'Ghi nhận của tổ trưởng sẽ hiện với trạng thái Chờ duyệt cho đến khi giáo viên duyệt — duyệt rồi mới tính điểm.' : 'Bạn thấy được điểm của mình và các thành viên trong tổ.'}</p>
    <div style="margin-bottom:14px">
      ${S.perms.addRecords && !isSummary ? `<button class="btn" id="btn-add-rec"><i class="fa-solid fa-plus"></i> Ghi nhận thành tích/vi phạm</button>` : ''}
    </div>
    <div id="pending-zone"></div>
    <div class="card"><h3><i class="fa-solid fa-table-list"></i> Tất cả ghi nhận trong tuần (${recs.length})</h3>
      ${recs.length ? `<table class="tbl"><thead><tr><th>Thời gian</th><th>Học sinh</th><th>Loại</th><th>Ghi chú</th><th>Người gửi</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${recs.map(row).join('')}</tbody></table>` : '<div class="empty">Chưa có ghi nhận nào trong tuần này</div>'}
    </div>
    <div class="card"><h3><i class="fa-solid fa-trophy"></i> Bảng điểm ${weekDisplay(S.week)}</h3>
      ${S.perms.isTeacher && sum.groups.length ? `<div class="grid3" style="margin-bottom:14px">${sum.groups.map(g => `
        <div class="card stat mb0" style="box-shadow:none;border:1px solid var(--border)">
          <div class="num" style="font-size:22px;color:${g.total >= (sum.baseStudentWeek || 10) ? 'var(--green)' : 'var(--red)'}">${g.total}</div>
          <div class="lbl">${esc(g.name)} (${g.count} HS)</div></div>`).join('')}</div>` : ''}
      <table class="tbl"><thead><tr><th>Học sinh</th><th>Thành tích</th><th>Vi phạm</th><th>Tổng</th><th style="width:180px"></th></tr></thead>
      <tbody>${sum.students.map(s => `<tr><td>${esc(s.name)}</td>
        <td style="color:var(--green)">+${s.achievement}</td><td style="color:var(--red)">-${s.violation}</td>
        <td><b>${s.total}</b></td>
        <td>${scoreBar(sum.baseStudentWeek, s.achievement, s.violation)}</td></tr>`).join('')}</tbody></table>
    </div>`;

  const pz = document.getElementById('pending-zone');
  if (!isSummary && S.perms.approveRecords && pending.length) renderPendingSection(pz, pending, refresh);
  if (!isSummary && document.getElementById('btn-add-rec')) {
    renderSubmitButton(document.getElementById('btn-add-rec'), refresh);
  }

  view.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => setStatus(b.dataset.approve, 'approved'));
  view.querySelectorAll('[data-reject]').forEach(b => b.onclick = () => setStatus(b.dataset.reject, 'rejected'));
  view.querySelectorAll('[data-delrec]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa ghi nhận này?')) {
      try { await api('/records/' + b.dataset.delrec, { method: 'DELETE' }); toast('Đã xóa', 'ok'); refresh(); } catch (e) { toast(e.message, 'err'); }
    }
  });

  async function setStatus(id, status) {
    try {
      await api(`/records/${id}/status`, { method: 'PUT', body: { status } });
      toast(status === 'approved' ? 'Đã duyệt' : 'Đã từ chối', 'ok');
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  }
}

function refresh() {
  import('../core/router.js').then(m => m.applyRouter());
}

registerRoute('records', { title: 'Thành tích & Vi phạm', icon: 'fa-scale-balanced', access: p => p.viewClass, render });
