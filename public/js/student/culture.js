import { api } from '../core/http.js';
import { S, weekDisplay } from '../core/state.js';
import { esc, toast, confirmDlg, fmtDate, renderContent, openModal } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { createEditor } from '../core/editor.js';
import { enhance } from '../core/controls.js';

async function render(el) {
  const [items, students] = await Promise.all([api('/culture?week=' + S.week), api('/students?all=1')]);
  const can = S.perms.manageCulture;
  const isSummary = typeof S.week === 'string';
  el.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-masks-theater"></i> Văn thể — ${weekDisplay(S.week)}</h2>
    <p class="page-sub">Các lần văn nghệ, hoạt động văn thể do lớp phó văn thể quản lý.</p>
    ${can && !isSummary ? `<div style="margin-bottom:12px"><button class="btn" id="ct-add"><i class="fa-solid fa-plus"></i> Thêm hoạt động văn thể</button></div>` : ''}
    ${items.length ? items.map(c => {
      const rated = students.filter(st => (c.ratings || {})[st.id]);
      return `
      <div class="card">
        <div class="group-head">
          <h4>${esc(c.name)}</h4>
          <span class="tag blue">${fmtDate(c.date)}</span>
          <span style="flex:1"></span>
          ${can && !isSummary ? `<button class="btn sm secondary" data-ct-rate="${c.id}"><i class="fa-solid fa-star"></i> Đánh giá</button> <button class="btn sm secondary" data-ct-edit="${c.id}"><i class="fa-solid fa-pen"></i> Sửa</button><button class="btn sm red" data-ct-del="${c.id}">Xóa</button>` : ''}
        </div>
        ${c.desc ? `<div class="md-preview">${renderContent(c.desc)}</div>` : ''}
        ${rated.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${rated.map(st => {
          const lv = (c.ratings || {})[st.id];
          return `<span class="tag ${lv === 'A' ? 'green' : lv === 'B' ? 'amber' : 'red'}">${esc(st.name)}: ${lv}</span>`;
        }).join('')}</div>` : ''}
      </div>`;
    }).join('') : '<div class="card empty">Chưa có hoạt động văn thể trong tuần này</div>'}`;
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
  el.querySelectorAll('[data-ct-rate]').forEach(b => {
    b.onclick = () => rateModal(items.find(x => x.id === Number(b.dataset.ctRate)), students);
  });

  function rateModal(item, students) {
    const snapshot = { ...(item.ratings || {}) };
    const m = openModal({
      title: `Đánh giá — ${item.name}`,
      wide: true,
      body: `
        <div class="lb-rate-grid">${students.map(st => {
          const lv = snapshot[st.id] || '';
          return `<div class="lb-rate-row"><span class="lb-rate-name">${esc(st.name)}</span>
            <span class="rate-btns" data-rt-sid="${st.id}"><button class="${lv === 'A' ? 'on-A' : ''}" data-rt-lv="A">A</button><button class="${lv === 'B' ? 'on-B' : ''}" data-rt-lv="B">B</button><button class="${lv === 'C' ? 'on-C' : ''}" data-rt-lv="C">C</button></span></div>`;
        }).join('')}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn secondary" id="rt-cancel">Hủy</button>
          <button class="btn" id="rt-save">Lưu đánh giá</button></div>`
    });
    enhance(m.el);
    m.el.querySelectorAll('.rate-btns').forEach(group => {
      const sid = group.dataset.rtSid;
      group.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          const lv = btn.dataset.rtLv;
          const cur = snapshot[sid] === lv;
          snapshot[sid] = cur ? '' : lv;
          group.querySelectorAll('button').forEach(b => {
            b.classList.remove('on-A', 'on-B', 'on-C');
          });
          if (!cur) btn.classList.add('on-' + lv);
        };
      });
    });
    m.el.querySelector('#rt-cancel').onclick = m.close;
    m.el.querySelector('#rt-save').onclick = async () => {
      try {
        await api(`/culture/${item.id}/ratings`, { method: 'PUT', body: { ratings: snapshot } });
        toast('Đã lưu đánh giá', 'ok');
        m.close();
        render(el);
      } catch (e) { toast(e.message, 'err'); }
    };
  }

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
