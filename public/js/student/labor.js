import { api } from '../core/http.js';
import { S, weekDisplay } from '../core/state.js';
import { esc, toast, confirmDlg, fmtDate, openModal } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { enhance } from '../core/controls.js';

const RATE_LV = ['A', 'B', 'C', 'V'];
const LV_TAG = lv => lv === 'A' ? 'green' : lv === 'B' ? 'amber' : lv === 'V' ? 'gray' : 'red';

async function render(el) {
  const [items, students] = await Promise.all([api('/labor?week=' + S.week), api('/students?all=1')]);
  const can = S.perms.manageLabor;
  const isSummary = typeof S.week === 'string';
  const total = students.length;
  el.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-broom"></i> Lao động — ${weekDisplay(S.week)}</h2>
    <p class="page-sub">Buổi lao động do lớp phó lao động quản lý, đánh giá mức A/B/C/V (V = vắng).</p>
    ${can && !isSummary ? `<div style="margin-bottom:12px"><button class="btn" id="lb-add"><i class="fa-solid fa-plus"></i> Thêm buổi lao động</button></div>` : ''}
    ${items.length ? items.map((l, idx) => {
      const rate = l.ratings || {};
      const attended = students.filter(st => ['A', 'B', 'C'].includes(rate[st.id])).length;
      const absent = students.filter(st => rate[st.id] === 'V').length;
      return `
      <div class="card acc ${idx === 0 ? 'open' : ''}">
        <div class="acc-head" data-acc>
          <span class="chev"><i class="fa-solid fa-chevron-right"></i></span>
          <div class="acc-title">
            <h4>${esc(l.name)}</h4>
            <div class="acc-meta">
              <span class="tag blue">${fmtDate(l.date)}</span>
              <span class="tag gray">Buổi ${esc(l.session)}</span>
              ${l.time ? `<span class="tag amber"><i class="fa-regular fa-clock"></i> ${esc(l.time)}</span>` : ''}
              <span class="tag green"><i class="fa-solid fa-user-check"></i> ${attended}/${total} đi</span>
              ${absent ? `<span class="tag gray"><i class="fa-solid fa-user-xmark"></i> Vắng ${absent}</span>` : ''}
            </div>
          </div>
          ${can && !isSummary ? `<span class="acc-actions">
            <button class="btn sm secondary" data-lb-rate="${l.id}"><i class="fa-solid fa-star"></i> Đánh giá</button>
            <button class="btn sm secondary" data-lb-edit="${l.id}"><i class="fa-solid fa-pen"></i> Sửa</button>
            <button class="btn sm red" data-lb-del="${l.id}">Xóa</button></span>` : ''}
        </div>
        <div class="acc-body"><div class="acc-inner">
          <table class="tbl lb-tbl"><thead><tr><th>STT</th><th>Học sinh</th><th>Xếp loại</th></tr></thead><tbody>${students.map((st, i) => {
            const lv = rate[st.id];
            return `<tr><td>${i + 1}</td><td>${esc(st.name)}</td><td>${lv ? `<span class="tag ${LV_TAG(lv)}">${lv}</span>` : '<span class="muted">—</span>'}</td></tr>`;
          }).join('')}</tbody></table>
        </div></div>
      </div>`;
    }).join('') : '<div class="card empty">Chưa có buổi lao động trong tuần này</div>'}`;

  const addBtn = document.getElementById('lb-add');
  if (addBtn) addBtn.onclick = () => laborModal(null, () => render(el));
  el.querySelectorAll('[data-acc]').forEach(h => {
    h.onclick = () => h.closest('.card').classList.toggle('open');
  });
  el.querySelectorAll('[data-lb-del]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();
    if (await confirmDlg('Xóa buổi lao động này?')) {
      try { await api('/labor/' + b.dataset.lbDel, { method: 'DELETE' }); toast('Đã xóa', 'ok'); render(el); } catch (e) { toast(e.message, 'err'); }
    }
  });
  el.querySelectorAll('[data-lb-edit]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    laborModal(items.find(x => x.id === Number(b.dataset.lbEdit)), () => render(el));
  });
  el.querySelectorAll('[data-lb-rate]').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      rateModal(items.find(x => x.id === Number(b.dataset.lbRate)), students);
    };
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
            <span class="rate-btns" data-rt-sid="${st.id}">${RATE_LV.map(r => `<button class="${lv === r ? 'on-' + r : ''}" data-rt-lv="${r}">${r}</button>`).join('')}</span></div>`;
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
            b.classList.remove(...RATE_LV.map(r => 'on-' + r));
          });
          if (!cur) btn.classList.add('on-' + lv);
        };
      });
    });
    m.el.querySelector('#rt-cancel').onclick = m.close;
    m.el.querySelector('#rt-save').onclick = async () => {
      try {
        await api(`/labor/${item.id}/ratings`, { method: 'PUT', body: { ratings: snapshot } });
        toast('Đã lưu đánh giá', 'ok');
        m.close();
        render(el);
      } catch (e) { toast(e.message, 'err'); }
    };
  }

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
