import { api } from '../core/http.js';
import { S, weekDisplay } from '../core/state.js';
import { esc, renderContent, toast, openModal, balancedGridCols } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { createEditor } from '../core/editor.js';

let _rvResizeFn = null;

async function render(view) {
  const reviews = await api('/reviews?week=' + S.week);
  const classRv = reviews.find(r => r.type === 'class');
  const studyRv = reviews.find(r => r.type === 'study');
  const leaderRv = reviews.filter(r => r.type === 'leader');
  const leaderByGroup = {};
  leaderRv.forEach(r => { if (r.groupId != null) leaderByGroup[r.groupId] = r; });
  const groupsList = S.groups.filter(g => g.id != null);
  const isSummary = typeof S.week === 'string';
  const myGroupId = S.student && S.student.groupId != null ? Number(S.student.groupId) : null;

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
      ${canEdit && !isSummary ? `<div style="text-align:right;margin-top:8px"><button class="btn sm secondary" data-rv-edit="${type}"><i class="fa-solid fa-pen"></i> ${rv && rv.content ? 'Sửa' : 'Viết nhận xét'}</button></div>` : ''}
    </div>`;

  const leaderCol = (g) => {
    const rv = leaderByGroup[g.id];
    const isMine = S.perms.reviewLeader && myGroupId === Number(g.id);
    return `
    <div class="card">
      <h3><i class="fa-solid fa-users"></i> ${esc(g.name)}</h3>
      <div id="rv-list-leader-${g.id}">
        ${rv && rv.content ? `<div class="muted" style="margin-bottom:4px"><b>${esc(rv.updatedByName || 'Tổ trưởng')}</b> • ${new Date(rv.updatedAt).toLocaleString('vi-VN')}</div>
        <div class="md-preview" style="min-height:30px">${renderContent(rv.content)}</div>`
      : '<div class="empty">Tổ trưởng chưa nhận xét</div>'}
      </div>
      <div id="rv-edit-leader-${g.id}" style="display:none">
        <div id="rv-editor-leader-${g.id}"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn secondary" data-rv-cancel="leader-${g.id}">Hủy</button>
          <button class="btn" data-rv-save="leader-${g.id}">Lưu nhận xét</button></div>
      </div>
      ${isMine && !isSummary ? `<div style="text-align:right;margin-top:8px"><button class="btn sm secondary" data-rv-edit="leader-${g.id}"><i class="fa-solid fa-pen"></i> ${rv && rv.content ? 'Sửa' : 'Viết'} nhận xét của tôi</button></div>` : ''}
    </div>`;
  };

  const leaderSection = groupsList.length
    ? `<div class="rv-cols">${groupsList.map(leaderCol).join('')}</div>`
    : `<div class="card"><h3><i class="fa-solid fa-users"></i> Tổ trưởng</h3>${
        leaderRv.length ? leaderRv.map(lv => `
          <div style="margin-bottom:14px">
            <div class="muted" style="margin-bottom:4px"><b>${esc(lv.updatedByName || 'Tổ trưởng')}</b> • ${new Date(lv.updatedAt).toLocaleString('vi-VN')}</div>
            <div class="md-preview" style="min-height:30px">${renderContent(lv.content)}</div>
          </div>`).join('') : '<div class="empty">Chưa có nhận xét của tổ trưởng</div>'
      }</div>`;

  view.innerHTML = `
    <h2 class="page-title">Nhận xét ${weekDisplay(S.week)}</h2>
    <p class="page-sub">Nhận xét chung của lớp trưởng, lớp phó học tập và từng tổ trưởng vào cuối mỗi tuần.</p>
    <div class="grid2">
      ${card('class', '<i class="fa-solid fa-user-tie"></i> Lớp trưởng', classRv, S.perms.reviewClass)}
      ${card('study', '<i class="fa-solid fa-book-open"></i> Lớp phó học tập', studyRv, S.perms.reviewStudy)}
    </div>
    ${leaderSection}`;

  const colsEl = view.querySelector('.rv-cols');
  if (colsEl) {
    if (_rvResizeFn) window.removeEventListener('resize', _rvResizeFn);
    const applyGrid = () => {
      if (!colsEl.isConnected) { window.removeEventListener('resize', applyGrid); return; }
      const n = Number(colsEl.dataset.items) || 1;
      colsEl.style.gridTemplateColumns = `repeat(${balancedGridCols(n, colsEl.clientWidth)}, minmax(0, 1fr))`;
    };
    colsEl.dataset.items = groupsList.length;
    _rvResizeFn = applyGrid;
    window.addEventListener('resize', applyGrid);
    applyGrid();
  }

  const targets = [{ key: 'class' }, { key: 'study' },
    ...groupsList.filter(g => S.perms.reviewLeader && myGroupId === Number(g.id)).map(g => ({ key: 'leader-' + g.id, gid: g.id }))];
  targets.forEach(({ key, gid }) => {
    const isLeader = key.startsWith('leader');
    const btn = view.querySelector(`[data-rv-edit="${key}"]`);
    const editBox = view.querySelector(`#rv-edit-${key}`);
    if (btn) btn.onclick = () => {
      const showEl = isLeader ? view.querySelector(`#rv-list-leader-${gid}`) : view.querySelector(`#rv-show-${key}`);
      if (showEl) showEl.style.display = 'none';
      btn.style.display = 'none';
      editBox.style.display = 'block';
      const editorContainer = view.querySelector(`#rv-editor-${key}`);
      const editor = createEditor(editorContainer, {
        placeholder: isLeader
          ? 'Nhận xét của tổ trưởng về tổ mình trong tuần...'
          : `Nhận xét chung tình hình ${key === 'class' ? 'lớp' : 'học tập'} trong tuần...`,
        height: '120px'
      });
      const rv = isLeader ? leaderByGroup[gid] : (key === 'class' ? classRv : studyRv);
      if (rv && rv.content) editor.setContents(rv.content);
      editorContainer._editor = editor;
    };
    const cancel = view.querySelector(`[data-rv-cancel="${key}"]`);
    if (cancel) cancel.onclick = () => render(view);
    const save = view.querySelector(`[data-rv-save="${key}"]`);
    if (save) save.onclick = async () => {
      const editorContainer = view.querySelector(`#rv-editor-${key}`);
      const editor = editorContainer._editor;
      const content = editor ? editor.getHTML() : '';
      try {
        if (isLeader) await api('/reviews/mine', { method: 'PUT', body: { week: S.week, content } });
        else await api('/reviews', { method: 'PUT', body: { week: S.week, type: key, content } });
        toast('Đã lưu nhận xét', 'ok');
        render(view);
      } catch (e) { toast(e.message, 'err'); }
    };
  });
}

registerRoute('reviews', { title: 'Nhận xét tuần', icon: 'fa-file-signature', access: p => p.viewClass, render });