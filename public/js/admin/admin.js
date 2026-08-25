import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, toast, confirmDlg, openModal } from '../core/ui.js';
import { registerRoute } from '../core/router.js';

async function render(view) {
  const teachers = await api('/users');
  const s = S.settings;
  view.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-gear"></i> Quản trị hệ thống</h2>
    <p class="page-sub">Chỉ ADMIN có quyền truy cập mục này.</p>
    <div class="grid2">
      <div class="card"><h3><i class="fa-solid fa-book"></i> Cài đặt lớp & năm học</h3>
        <div class="row-flex">
          <div style="flex:1"><label class="f">Năm học</label><input type="text" id="st-year" value="${esc(s.schoolYear)}"></div>
          <div style="flex:1"><label class="f">Tên lớp</label><input type="text" id="st-class" value="${esc(s.className)}"></div>
        </div>
        <div class="row-flex">
          <div style="flex:1"><label class="f">Khối</label><select id="st-grade">${[10, 11, 12].map(k => `<option value="${k}" ${s.grade === k ? 'selected' : ''}>Khối ${k}</option>`).join('')}</select></div>
          <div style="flex:1"><label class="f">Số tuần năm học</label><input type="number" id="st-weeks" min="1" max="60" value="${s.weeks}"></div>
        </div>
        <label class="f">Ngày bắt đầu năm học (tuần 1)</label><input type="date" id="st-start" value="${s.startDate}">
        <div class="row-flex">
          <div style="flex:1"><label class="f">Điểm mặc định/tuần — học sinh</label><input type="number" id="st-basestu" min="0" value="${s.baseStudentWeek}"></div>
          <div style="flex:1"><label class="f">Điểm mặc định/tuần — cả lớp</label><input type="number" id="st-basecls" min="0" value="${s.baseClassWeek}"></div>
        </div>
        <div style="text-align:right;margin-top:12px"><button class="btn" id="st-save"><i class="fa-solid fa-floppy-disk"></i> Lưu cài đặt</button></div>
      </div>
      <div class="card"><h3><i class="fa-solid fa-chalkboard-user"></i> Tài khoản giáo viên</h3>
        <div style="margin-bottom:10px"><button class="btn" id="tc-add"><i class="fa-solid fa-user-plus"></i> Thêm giáo viên</button></div>
        <table class="tbl"><thead><tr><th>Tên</th><th>Tài khoản</th><th class="actions"></th></tr></thead>
        <tbody>${teachers.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.username)}</td>
          <td class="actions"><button class="btn sm secondary" data-tc-pw="${t.id}"><i class="fa-solid fa-key"></i> Đổi MK</button> <button class="btn sm red" data-tc-del="${t.id}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('')}</tbody></table>
      </div>
    </div>
    <div class="grid2">
      <div class="card"><h3><i class="fa-solid fa-trophy"></i> Loại thành tích (điểm cộng)</h3>
        <div style="margin-bottom:10px"><button class="btn green" data-type-add="achievement"><i class="fa-solid fa-plus"></i> Thêm loại thành tích</button></div>
        <table class="tbl"><thead><tr><th>Tên</th><th>Điểm cộng</th><th class="actions"></th></tr></thead>
        <tbody>${S.types.filter(t => t.kind === 'achievement').map(t => `<tr><td>${esc(t.name)}</td><td><b>+${t.points}</b></td>
          <td class="actions"><button class="btn sm secondary" data-type-edit="${t.id}"><i class="fa-solid fa-pen"></i></button> <button class="btn sm red" data-type-del="${t.id}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('')}</tbody></table>
      </div>
      <div class="card"><h3><i class="fa-solid fa-triangle-exclamation"></i> Loại vi phạm (điểm trừ)</h3>
        <div style="margin-bottom:10px"><button class="btn red" data-type-add="violation"><i class="fa-solid fa-plus"></i> Thêm loại vi phạm</button></div>
        <table class="tbl"><thead><tr><th>Tên</th><th>Điểm trừ</th><th class="actions"></th></tr></thead>
        <tbody>${S.types.filter(t => t.kind === 'violation').map(t => `<tr><td>${esc(t.name)}</td><td><b>-${t.points}</b></td>
          <td class="actions"><button class="btn sm secondary" data-type-edit="${t.id}"><i class="fa-solid fa-pen"></i></button> <button class="btn sm red" data-type-del="${t.id}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('')}</tbody></table>
      </div>
    </div>`;

  document.getElementById('st-save').onclick = async () => {
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          schoolYear: document.getElementById('st-year').value,
          className: document.getElementById('st-class').value,
          grade: Number(document.getElementById('st-grade').value),
          weeks: Number(document.getElementById('st-weeks').value),
          startDate: document.getElementById('st-start').value,
          baseStudentWeek: Number(document.getElementById('st-basestu').value),
          baseClassWeek: Number(document.getElementById('st-basecls').value)
        }
      });
      await reload();
      toast('Đã lưu cài đặt', 'ok');
      rerender();
    } catch (e) { toast(e.message, 'err'); }
  };

  document.getElementById('tc-add').onclick = () => teacherModal(null);
  view.querySelectorAll('[data-tc-del]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa tài khoản giáo viên này?')) {
      try { await api('/users/' + b.dataset.tcDel, { method: 'DELETE' }); toast('Đã xóa', 'ok'); render(view); } catch (e) { toast(e.message, 'err'); }
    }
  });
  view.querySelectorAll('[data-tc-pw]').forEach(b => b.onclick = () => teacherModal(teachers.find(t => t.id === Number(b.dataset.tcPw))));

  function teacherModal(item) {
    const m = openModal({
      title: item ? 'Sửa giáo viên / đổi mật khẩu' : 'Thêm giáo viên',
      body: `
        <label class="f">Họ tên</label><input type="text" id="tc-name" value="${esc(item ? item.name : '')}">
        ${item ? '' : '<label class="f">Tài khoản</label><input type="text" id="tc-user">'}
        <label class="f">Mật khẩu ${item ? '(để trống nếu giữ nguyên)' : ''}</label><input type="text" id="tc-pass">
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="tc-cancel">Hủy</button>
          <button class="btn" id="tc-save">Lưu</button></div>`
    });
    m.el.querySelector('#tc-cancel').onclick = m.close;
    m.el.querySelector('#tc-save').onclick = async () => {
      try {
        if (item) {
          await api('/users/' + item.id, { method: 'PUT', body: { name: m.el.querySelector('#tc-name').value, password: m.el.querySelector('#tc-pass').value || undefined } });
        } else {
          await api('/users', { method: 'POST', body: { name: m.el.querySelector('#tc-name').value, username: m.el.querySelector('#tc-user').value, password: m.el.querySelector('#tc-pass').value } });
        }
        toast('Đã lưu', 'ok');
        m.close();
        render(view);
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  view.querySelectorAll('[data-type-add]').forEach(b => b.onclick = () => typeModal({ kind: b.dataset.typeAdd }));
  view.querySelectorAll('[data-type-edit]').forEach(b => b.onclick = () => typeModal(S.types.find(t => t.id === Number(b.dataset.typeEdit))));
  view.querySelectorAll('[data-type-del]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa loại này? Các bản ghi cũ sẽ mất tham chiếu tên.')) {
      try { await api('/types/' + b.dataset.typeDel, { method: 'DELETE' }); await reload(); toast('Đã xóa', 'ok'); render(view); } catch (e) { toast(e.message, 'err'); }
    }
  });

  function typeModal(item) {
    const isAdd = !item.id;
    const m = openModal({
      title: isAdd ? (item.kind === 'achievement' ? 'Thêm loại thành tích' : 'Thêm loại vi phạm') : 'Sửa loại',
      body: `
        <label class="f">Tên</label><input type="text" id="tp-name" value="${esc(isAdd ? '' : item.name)}">
        <label class="f">Số điểm ${isAdd ? '' : (item.kind === 'achievement' ? 'cộng' : 'trừ')} mỗi lần</label>
        <input type="number" id="tp-points" min="1" value="${isAdd ? 1 : item.points}">
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="tp-cancel">Hủy</button>
          <button class="btn" id="tp-save">Lưu</button></div>`
    });
    m.el.querySelector('#tp-cancel').onclick = m.close;
    m.el.querySelector('#tp-save').onclick = async () => {
      const body = { name: m.el.querySelector('#tp-name').value, points: Number(m.el.querySelector('#tp-points').value) };
      try {
        if (isAdd) await api('/types', { method: 'POST', body: { ...body, kind: item.kind } });
        else await api('/types/' + item.id, { method: 'PUT', body });
        await reload();
        toast('Đã lưu loại', 'ok');
        m.close();
        render(view);
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  async function reload() {
    const { loadBootstrap } = await import('../core/state.js');
    await loadBootstrap();
  }
}

function rerender() {
  import('../core/router.js').then(r => r.applyRouter());
}

registerRoute('admin', { title: 'Quản trị', icon: 'fa-gear', access: p => p.admin, render });
