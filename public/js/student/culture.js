import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, toast, confirmDlg, fmtDate, renderContent, openModal } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { createEditor } from '../core/editor.js';

async function render(el) {
  const [items, students] = await Promise.all([api('/culture?week=' + S.week), api('/students')]);
  const can = S.perms.manageCulture;
  el.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-masks-theater"></i> Văn thể — Tuần ${S.week}</h2>
    <p class="page-sub">Các lần văn nghệ, hoạt động văn thể do lớp phó văn thể quản lý.</p>
    ${can ? `<div style="margin-bottom:12px"><button class="btn" id="ct-add"><i class="fa-solid fa-plus"></i> Thêm hoạt động văn thể</button></div>` : ''}
    ${items.length ? items.map(c => `
      <div class="card">
        <div class="group-head">
          <h4>${esc(c.name)}</h4>
          <span class="tag blue">${fmtDate(c.date)}</span>
          <span style="flex:1"></span>
          ${can ? `<button class="btn sm secondary" data-ct-edit="${c.id}"><i class="fa-solid fa-pen"></i> Sửa</button><button class="btn sm red" data-ct-del="${c.id}">Xóa</button>` : ''}
        </div>
        ${c.desc ? `<div class="md-preview">${renderContent(c.desc)}</div>` : ''}
        <table class="tbl" style="margin-top:8px"><thead><tr><th>Học sinh</th><th>Đánh giá</th></tr></thead>
        <tbody>${students.map(st => {
          const lv = (c.ratings || {})[st.id] || '';
          return `<tr><td>${esc(st.name)}</td><td>${
            can
              ? `<span class="rate-btns"><button class="${lv === 'A' ? 'on-A' : ''}" data-cid="${c.id}" data-sid="${st.id}" data-lv="A">A</button><button class="${lv === 'B' ? 'on-B' : ''}" data-cid="${c.id}" data-sid="${st.id}" data-lv="B">B</button><button class="${lv === 'C' ? 'on-C' : ''}" data-cid="${c.id}" data-sid="${st.id}" data-lv="C">C</button></span>`
              : (lv ? `<span class="tag ${lv === 'A' ? 'green' : lv === 'B' ? 'amber' : 'red'}">${lv}</span>` : '<span class="muted">—</span>')
          }</td></tr>`;
        }).join('')}</tbody></table>
      </div>`).join('') : '<div class="card empty">Chưa có hoạt động văn thể trong tuần này</div>'}`;
  const addBtn = document.getElementById('ct-add');
  if (addBtn) addBtn.onclick = () => cultureModal(null, () => render(el));
  el.querySelectorAll('[data-ct-del]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa hoạt động này?')) {
      try { await api('/culture/' + b.dataset.ctDel, { method: 'DELETE' }); toast('Đã xóa', 'ok'); render(el); } catch (e) { toast(e.message, 'err'); }
    }
  });
  el.querySelectorAll('[data-ct-edit]').forEach(b => b.onclick = () => {
    cultureModal(items.find(x => x.id === Number(b.dataset.ctEdit)), () => render(el));
  });
  el.querySelectorAll('.rate-btns button').forEach(btn => btn.onclick = async () => {
    const lv = btn.dataset.lv;
    const cur = btn.classList.contains('on-' + lv);
    try {
      await api(`/culture/${btn.dataset.cid}/ratings`, { method: 'PUT', body: { ratings: { [btn.dataset.sid]: cur ? '' : lv } } });
      render(el);
    } catch (e) { toast(e.message, 'err'); }
  });

  function cultureModal(item, done) {
    const m = openModal({
      title: item ? 'Sửa hoạt động' : 'Thêm hoạt động văn thể',
      body: `
        <label class="f">Tên hoạt động</label><input type="text" id="ct-name" value="${esc(item ? item.name : '')}">
        <label class="f">Ngày</label><input type="date" id="ct-date" value="${item ? item.date : new Date().toISOString().slice(0, 10)}">
        <label class="f">Mô tả</label>
        <div id="ct-editor"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="ct-cancel">Hủy</button>
          <button class="btn" id="ct-save">Lưu</button></div>`
    });
    const editor = createEditor(m.el.querySelector('#ct-editor'), { placeholder: 'Mô tả hoạt động...', height: '140px' });
    if (item && item.desc) editor.setContents(item.desc);
    m.el.querySelector('#ct-cancel').onclick = m.close;
    m.el.querySelector('#ct-save').onclick = async () => {
      const body = { name: m.el.querySelector('#ct-name').value, date: m.el.querySelector('#ct-date').value, desc: editor.getHTML() };
      try {
        if (item) await api('/culture/' + item.id, { method: 'PUT', body });
        else await api('/culture', { method: 'POST', body });
        toast('Đã lưu', 'ok');
        m.close();
        done();
      } catch (e) { toast(e.message, 'err'); }
    };
  }
}

registerRoute('culture', { title: 'Văn thể', icon: 'fa-masks-theater', hidden: true, render });
export { render };
