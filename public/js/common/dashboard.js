import { api } from '../core/http.js';
import { S, POS_LABEL } from '../core/state.js';
import { esc, renderContent, scoreBar } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { setBadge } from '../core/layout.js';

async function render(view) {
  const [sum, anns] = await Promise.all([api('/summary'), api('/announcements')]);
  setBadge('records', sum.pendingCount || 0);
  let statsHtml = '';
  if (S.perms.isTeacher) {
    statsHtml = `
      <div class="grid3">
        <div class="card stat blue"><div class="num">${sum.classTotal}</div><div class="lbl">Điểm tuần này của lớp (mặc định ${sum.baseClassWeek})</div></div>
        <div class="card stat green"><div class="num">${sum.students.reduce((t, s) => t + s.achievement, 0)}</div><div class="lbl">Tổng điểm thành tích</div></div>
        <div class="card stat red"><div class="num">${sum.students.reduce((t, s) => t + s.violation, 0)}</div><div class="lbl">Tổng điểm vi phạm</div></div>
      </div>
      <div class="card"><h3>Điểm các tổ (trung bình)</h3><div class="grid3">
        ${sum.groups.map(g => `<div class="card stat mb0" style="box-shadow:none;border:1px solid var(--border)">
          <div class="num" style="font-size:22px;color:${g.total >= (sum.baseStudentWeek || 10) ? 'var(--green)' : 'var(--red)'}">${g.total}</div>
          <div class="lbl">${esc(g.name)} (${g.count} HS)</div></div>`).join('')}
      </div></div>`;
  } else if (S.perms.isStudent && sum.students.length) {
    const mineId = (S.student || {}).id;
    const mine = sum.students.find(s => s.id === mineId);
    const myGroup = S.groups.find(g => g.id === (S.student || {}).groupId) || {};
    const ini = ((S.me.name || '').split(/\s+/).map(w => w[0]).slice(-2).join('') || '?').toUpperCase();
    const profileCard = `
      <div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        ${(S.student || {}).photo
          ? `<img class="profile-photo" src="${esc(S.student.photo)}" alt="">`
          : `<div class="avatar xl">${esc(ini)}</div>`}
        <div style="flex:1">
          <b style="font-size:16px">${esc(S.me.name)}</b>
          <div class="muted" style="margin-top:2px">
            <i class="fa-solid fa-id-badge"></i> ${esc(POS_LABEL[(S.student || {}).position] || 'Học sinh')}
            • <i class="fa-solid fa-users-rectangle"></i> ${esc(myGroup.name || '')}
            • <i class="fa-solid fa-school"></i> Lớp ${esc(S.settings.className)}
          </div>
        </div>
      </div>`;
    statsHtml = `
      ${profileCard}
      <div class="grid3">
        <div class="card stat green"><div class="num">${mine ? mine.achievement : 0}</div><div class="lbl">Điểm thành tích của tôi</div></div>
        <div class="card stat red"><div class="num">${mine ? mine.violation : 0}</div><div class="lbl">Điểm vi phạm của tôi</div></div>
        <div class="card stat blue"><div class="num">${mine ? mine.total : 0}</div><div class="lbl">Điểm tuần này của tôi (mặc định ${sum.baseStudentWeek})</div>
          ${scoreBar(sum.baseStudentWeek, mine ? mine.achievement : 0, mine ? mine.violation : 0)}</div>
      </div>
      <div class="card"><h3>Tổ của tôi</h3>
        <table class="tbl"><thead><tr><th>Học sinh</th><th>Thành tích</th><th>Vi phạm</th><th>Tổng</th></tr></thead>
        <tbody>${sum.students.map(s => `<tr><td>${esc(s.name)}${s.id === mineId ? ' <span class="tag blue">Tôi</span>' : ''}</td>
          <td style="color:var(--green)">+${s.achievement}</td><td style="color:var(--red)">-${s.violation}</td>
          <td><b>${s.total}</b></td></tr>`).join('')}</tbody></table></div>`;
  } else if (S.perms.admin) {
    const c = S.counts || {};
    statsHtml = `
      <div class="grid3">
        <div class="card stat blue"><div class="num">${c.teachers ?? '-'}</div><div class="lbl">Tài khoản giáo viên</div></div>
        <div class="card stat green"><div class="num">${c.types ?? '-'}</div><div class="lbl">Loại thành tích / vi phạm</div></div>
        <div class="card stat"><div class="num">${S.settings.weeks}</div><div class="lbl">Số tuần trong năm học</div></div>
      </div>
      <div class="card"><h3><i class="fa-solid fa-book"></i> Cấu hình hệ thống hiện tại</h3>
        <table class="tbl">
          <tr><td>Năm học</td><td><b>${esc(S.settings.schoolYear)}</b></td></tr>
          <tr><td>Lớp / Khối</td><td><b>${esc(S.settings.className)}</b> • Khối ${S.settings.grade}</td></tr>
          <tr><td>Ngày bắt đầu (tuần 1)</td><td>${new Date(S.settings.startDate + 'T00:00:00').toLocaleDateString('vi-VN')}</td></tr>
          <tr><td>Điểm mặc định mỗi tuần (học sinh / cả lớp)</td><td><b>${S.settings.baseStudentWeek}</b> / <b>${S.settings.baseClassWeek}</b></td></tr>
        </table>
        <div class="muted" style="margin-top:8px">Theo phân quyền, ADMIN chỉ quản lý giáo viên, loại điểm và cấu hình — dữ liệu lớp do GIÁO VIÊN quản lý.</div>
      </div>`;
  }
  view.innerHTML = `
    <h2 class="page-title">Tổng quan</h2>
    <p class="page-sub">${S.perms.admin ? 'Quản trị hệ thống' : esc(S.settings.className) + ' • Năm học ' + esc(S.settings.schoolYear)} • Tuần ${S.week}/${S.settings.weeks}</p>
    ${statsHtml}
    <div class="card"><h3><i class="fa-solid fa-bullhorn"></i> Thông báo</h3>
      ${anns.length ? anns.map(a => `
        <div class="card ann-card" style="box-shadow:none;border:1px solid var(--border);border-left:4px solid var(--primary);margin-bottom:10px">
          <h4>${esc(a.title)}</h4>
          <div class="ann-meta"><i class="fa-solid fa-user"></i> ${esc(a.createdBy || '')}${a.expiresAt ? ` • Hết hạn: ${new Date(a.expiresAt).toLocaleString('vi-VN')}` : ''}</div>
          <div class="md-preview">${renderContent(a.content)}</div>
        </div>`).join('') : '<div class="empty">Chưa có thông báo nào</div>'}
    </div>`;
}

registerRoute('dashboard', { title: 'Tổng quan', icon: 'fa-house', render });
