import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, mdToHtml, toast, confirmDlg } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { openAnModal } from '../student/announcements-manage.js';

async function render(view) {
  const list = await api(S.perms.manageAnnouncements ? '/announcements?all=1' : '/announcements');
  const can = S.perms.manageAnnouncements;
  const audLabel = { all: '<i class="fa-solid fa-users"></i> Tất cả', students: '<i class="fa-solid fa-graduation-cap"></i> Học sinh', teachers: '<i class="fa-solid fa-chalkboard-user"></i> Giáo viên' };
  view.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-bullhorn"></i> Thông báo</h2>
    <p class="page-sub">Thông báo từ ban cán sự lớp, tự động ẩn sau thời gian hết hạn.</p>
    ${can ? `<div style="margin-bottom:14px"><button class="btn" id="an-add"><i class="fa-solid fa-plus"></i> Thêm thông báo</button></div>` : ''}
    ${list.length ? list.map(a => {
      const expired = a.expiresAt && new Date(a.expiresAt).getTime() <= Date.now();
      return `<div class="card ann-card" style="${expired ? 'opacity:.55;' : ''}">
        <div class="group-head"><h4>${esc(a.title)}</h4>
          <span class="tag blue">${audLabel[a.audience] || ''}</span>
          ${expired ? '<span class="tag gray">Hết hạn</span>' : ''}
          <span class="spacer" style="flex:1"></span>
          ${can ? `<button class="btn sm secondary" data-an-edit="${a.id}"><i class="fa-solid fa-pen"></i> Sửa</button> <button class="btn sm red" data-an-del="${a.id}">Xóa</button>` : ''}
        </div>
        <div class="ann-meta"><i class="fa-solid fa-user"></i> ${esc(a.createdBy || '')} • <i class="fa-regular fa-clock"></i> ${new Date(a.createdAt).toLocaleString('vi-VN')}${a.expiresAt ? ` • Hết hạn: ${new Date(a.expiresAt).toLocaleString('vi-VN')}` : ' • Không hết hạn'}</div>
        <div class="md-preview">${mdToHtml(a.content)}</div>
      </div>`;
    }).join('') : '<div class="card empty">Chưa có thông báo nào</div>'}`;
  if (can) {
    document.getElementById('an-add').onclick = () => openAnModal(null, () => render(view));
    view.querySelectorAll('[data-an-del]').forEach(b => b.onclick = async () => {
      if (await confirmDlg('Xóa thông báo này?')) {
        try { await api('/announcements/' + b.dataset.anDel, { method: 'DELETE' }); toast('Đã xóa', 'ok'); render(view); } catch (e) { toast(e.message, 'err'); }
      }
    });
    view.querySelectorAll('[data-an-edit]').forEach(b => b.onclick = () => {
      openAnModal(list.find(x => x.id === Number(b.dataset.anEdit)), () => render(view));
    });
  }
}

registerRoute('announcements', { title: 'Thông báo', icon: 'fa-bullhorn', access: p => p.viewClass, render });
