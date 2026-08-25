import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, mdToHtml, toast, openModal } from '../core/ui.js';
import { registerRoute } from '../core/router.js';

async function render(view) {
  const reviews = await api('/reviews?week=' + S.week);
  const classRv = reviews.find(r => r.type === 'class');
  const studyRv = reviews.find(r => r.type === 'study');
  const card = (type, title, rv, canEdit) => `
    <div class="card"><h3>${title}</h3>
      <div id="rv-show-${type}">
        ${rv && rv.content ? `<div class="md-preview" style="min-height:40px">${mdToHtml(rv.content)}</div>
        <div class="muted" style="margin-top:6px">Cập nhật: ${esc(rv.updatedByName || '')} • ${new Date(rv.updatedAt).toLocaleString('vi-VN')}</div>`
      : '<div class="empty">Chưa có nhận xét cho tuần này</div>'}
      </div>
      <div id="rv-edit-${type}" style="display:none">
        <textarea id="rv-text-${type}" placeholder="Nhận xét chung tình hình ${type === 'class' ? 'lớp' : 'học tập'} trong tuần..."></textarea>
        <div class="md-preview" id="rv-prev-${type}"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn secondary" data-rv-cancel="${type}">Hủy</button>
          <button class="btn" data-rv-save="${type}">Lưu nhận xét</button></div>
      </div>
      ${canEdit ? `<div style="text-align:right;margin-top:8px"><button class="btn sm secondary" data-rv-edit="${type}"><i class="fa-solid fa-pen"></i> ${rv && rv.content ? 'Sửa' : 'Viết nhận xét'}</button></div>` : ''}
    </div>`;
  view.innerHTML = `
    <h2 class="page-title">Nhận xét tuần ${S.week}</h2>
    <p class="page-sub">Nhận xét chung của lớp trưởng và lớp phó học tập vào cuối mỗi tuần.</p>
    <div class="grid2">
      ${card('class', '<i class="fa-solid fa-user-tie"></i> Lớp trưởng', classRv, S.perms.reviewClass)}
      ${card('study', '<i class="fa-solid fa-book-open"></i> Lớp phó học tập', studyRv, S.perms.reviewStudy)}
    </div>`;
  ['class', 'study'].forEach(type => {
    const btn = view.querySelector(`[data-rv-edit="${type}"]`);
    if (btn) btn.onclick = () => {
      view.querySelector(`#rv-show-${type}`).style.display = 'none';
      view.querySelector(`#rv-edit-${type}`).style.display = 'block';
      const ta = view.querySelector(`#rv-text-${type}`);
      ta.value = ((type === 'class' ? classRv : studyRv) || {}).content || '';
      const prev = view.querySelector(`#rv-prev-${type}`);
      const upd = () => { prev.innerHTML = mdToHtml(ta.value); };
      ta.oninput = upd;
      upd();
      ta.focus();
    };
    const cancel = view.querySelector(`[data-rv-cancel="${type}"]`);
    if (cancel) cancel.onclick = () => render(view);
    const save = view.querySelector(`[data-rv-save="${type}"]`);
    if (save) save.onclick = async () => {
      try {
        await api('/reviews', { method: 'PUT', body: { week: S.week, type, content: view.querySelector(`#rv-text-${type}`).value } });
        toast('Đã lưu nhận xét', 'ok');
        render(view);
      } catch (e) { toast(e.message, 'err'); }
    };
  });
}

registerRoute('reviews', { title: 'Nhận xét tuần', icon: 'fa-file-signature', access: p => p.viewClass, render });
