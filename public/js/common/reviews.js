import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, renderContent, toast, openModal } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { createEditor } from '../core/editor.js';

async function render(view) {
  const reviews = await api('/reviews?week=' + S.week);
  const classRv = reviews.find(r => r.type === 'class');
  const studyRv = reviews.find(r => r.type === 'study');
  const card = (type, title, rv, canEdit) => `
    <div class="card"><h3>${title}</h3>
      <div id="rv-show-${type}">
        ${rv && rv.content ? `<div class="md-preview" style="min-height:40px">${renderContent(rv.content)}</div>
        <div class="muted" style="margin-top:6px">Cập nhật: ${esc(rv.updatedByName || '')} • ${new Date(rv.updatedAt).toLocaleString('vi-VN')}</div>`
      : '<div class="empty">Chưa có nhận xét cho tuần này</div>'}
      </div>
      <div id="rv-edit-${type}" style="display:none">
        <div id="rv-editor-${type}"></div>
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
      const editorContainer = view.querySelector(`#rv-editor-${type}`);
      const editor = createEditor(editorContainer, {
        placeholder: `Nhận xét chung tình hình ${type === 'class' ? 'lớp' : 'học tập'} trong tuần...`,
        height: '120px'
      });
      const rv = type === 'class' ? classRv : studyRv;
      if (rv && rv.content) editor.setContents(rv.content);
      editorContainer._editor = editor;
    };
    const cancel = view.querySelector(`[data-rv-cancel="${type}"]`);
    if (cancel) cancel.onclick = () => render(view);
    const save = view.querySelector(`[data-rv-save="${type}"]`);
    if (save) save.onclick = async () => {
      const editorContainer = view.querySelector(`#rv-editor-${type}`);
      const editor = editorContainer._editor;
      const content = editor ? editor.getHTML() : '';
      try {
        await api('/reviews', { method: 'PUT', body: { week: S.week, type, content } });
        toast('Đã lưu nhận xét', 'ok');
        render(view);
      } catch (e) { toast(e.message, 'err'); }
    };
  });
}

registerRoute('reviews', { title: 'Nhận xét tuần', icon: 'fa-file-signature', access: p => p.viewClass, render });
