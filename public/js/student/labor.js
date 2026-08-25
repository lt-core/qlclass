import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, toast, confirmDlg, fmtDate } from '../core/ui.js';
import { registerRoute } from '../core/router.js';

async function render(el) {
  const [items, students] = await Promise.all([api('/labor?week=' + S.week), api('/students')]);
  const can = S.perms.manageLabor;
  el.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-broom"></i> Lao động — Tuần ${S.week}</h2>
    <p class="page-sub">Buổi lao động do lớp phó lao động quản lý, đánh giá mức A/B/C từng học sinh.</p>
    ${can ? `<div style="margin-bottom:12px"><button class="btn" id="lb-add"><i class="fa-solid fa-plus"></i> Thêm buổi lao động</button></div>` : ''}
    ${items.length ? items.map(l => `
      <div class="card">
        <div class="group-head">
          <h4>${esc(l.name)}</h4>
          <span class="tag blue">${fmtDate(l.date)}</span>
          <span class="tag gray">Buổi ${esc(l.session)}</span>
          ${l.time ? `<span class="tag amber"><i class="fa-regular fa-clock"></i> ${esc(l.time)}</span>` : ''}
          <span style="flex:1"></span>
          ${can ? `<button class="btn sm secondary" data-lb-edit="${l.id}"><i class="fa-solid fa-pen"></i> Sửa</button><button class="btn sm red" data-lb-del="${l.id}">Xóa</button>` : ''}
        </div>
        <table class="tbl"><thead><tr><th>Học sinh</th><th>Đánh giá</th></tr></thead>
        <tbody>${students.map(st => {
          const lv = (l.ratings || {})[st.id] || '';
          return `<tr><td>${esc(st.name)}</td><td>${
            can
              ? `<span class="rate-btns"><button class="${lv === 'A' ? 'on-A' : ''}" data-lid="${l.id}" data-sid="${st.id}" data-lv="A">A</button><button class="${lv === 'B' ? 'on-B' : ''}" data-lid="${l.id}" data-sid="${st.id}" data-lv="B">B</button><button class="${lv === 'C' ? 'on-C' : ''}" data-lid="${l.id}" data-sid="${st.id}" data-lv="C">C</button>${lv ? ` <span class="muted">(hiện tại: ${lv})</span>` : ''}</span>`
              : (lv ? `<span class="tag ${lv === 'A' ? 'green' : lv === 'B' ? 'amber' : 'red'}">${lv}</span>` : '<span class="muted">—</span>')
          }</td></tr>`;
        }).join('')}</tbody></table>
      </div>`).join('') : '<div class="card empty">Chưa có buổi lao động trong tuần này</div>'}`;
  const addBtn = document.getElementById('lb-add');
  if (addBtn) addBtn.onclick = () => laborModal(null, () => render(el));
  el.querySelectorAll('[data-lb-del]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa buổi lao động này?')) {
      try { await api('/labor/' + b.dataset.lbDel, { method: 'DELETE' }); toast('Đã xóa', 'ok'); render(el); } catch (e) { toast(e.message, 'err'); }
    }
  });
  el.querySelectorAll('[data-lb-edit]').forEach(b => b.onclick = () => {
    laborModal(items.find(x => x.id === Number(b.dataset.lbEdit)), () => render(el));
  });
  el.querySelectorAll('.rate-btns button').forEach(btn => btn.onclick = async () => {
    const lv = btn.dataset.lv;
    const cur = btn.classList.contains('on-' + lv);
    try {
      await api(`/labor/${btn.dataset.lid}/ratings`, { method: 'PUT', body: { ratings: { [btn.dataset.sid]: cur ? '' : lv } } });
      render(el);
    } catch (e) { toast(e.message, 'err'); }
  });

  function laborModal(item, done) {
    const m = openModal({
      title: item ? 'Sửa buổi lao động' : 'Thêm buổi lao động',
      body: `
        <label class="f">Tên buổi lao động</label><input type="text" id="lb-name" value="${esc(item ? item.name : '')}">
        <div class="row-flex">
          <div style="flex:1"><label class="f">Ngày</label><input type="date" id="lb-date" value="${item ? item.date : new Date().toISOString().slice(0, 10)}"></div>
          <div style="flex:1"><label class="f">Buổi</label><select id="lb-session">${['Sáng', 'Chiều', 'Tối'].map(s => `<option ${item && item.session === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div style="flex:1"><label class="f">Thời gian</label><input type="text" id="lb-time" placeholder="VD: 7h00-10h00" value="${esc(item ? item.time : '')}"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="lb-cancel">Hủy</button>
          <button class="btn" id="lb-save">Lưu</button></div>`
    });
    m.el.querySelector('#lb-cancel').onclick = m.close;
    m.el.querySelector('#lb-save').onclick = async () => {
      const body = {
        name: m.el.querySelector('#lb-name').value,
        date: m.el.querySelector('#lb-date').value,
        session: m.el.querySelector('#lb-session').value,
        time: m.el.querySelector('#lb-time').value
      };
      try {
        if (item) await api('/labor/' + item.id, { method: 'PUT', body });
        else await api('/labor', { method: 'POST', body });
        toast('Đã lưu', 'ok');
        m.close();
        done();
      } catch (e) { toast(e.message, 'err'); }
    };
  }
}

registerRoute('labor', { title: 'Lao động', icon: 'fa-broom', hidden: true, render });
export { render };
