import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, toast, confirmDlg, openModal } from '../core/ui.js';
import { registerRoute } from '../core/router.js';

let activeTab = 'classes';

function classById(id) {
  return (S.classes || []).find(c => Number(c.id) === Number(id));
}

function cur() {
  return classById(S.currentClassId) || (S.classes || [])[0] || null;
}

async function switchClass(id) {
  await api('/current-class', { method: 'PUT', body: { id: Number(id) } });
  const { S, loadBootstrap } = await import('../core/state.js');
  S.currentClassId = Number(id);
  await loadBootstrap();
}

async function render(view) {
  const teachers = await api('/users');
  const cls = cur();
  view.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-gear"></i> Quản trị hệ thống</h2>
    <div class="subtabs">
      <button data-atab="classes" class="${activeTab === 'classes' ? 'active' : ''}"><i class="fa-solid fa-school"></i> Lớp học · Năm học</button>
      <button data-atab="teachers" class="${activeTab === 'teachers' ? 'active' : ''}"><i class="fa-solid fa-chalkboard-user"></i> Giáo viên</button>
    </div>
    <div id="admin-body">${cls ? '' : '<p class="muted">Chưa có lớp nào.</p>'}</div>`;

  view.querySelectorAll('[data-atab]').forEach(b => b.onclick = () => {
    activeTab = b.dataset.atab;
    render(view);
  });

  const body = document.getElementById('admin-body');
  if (!cls) return;
  if (activeTab === 'classes') renderClassesTab(body, cls, teachers);
  else renderTeachersTab(body, teachers);
}

function renderClassesTab(body, cls, teachers) {
  const refresh = () => render(document.getElementById('view'));
  const ach = (cls.types || []).filter(t => t.kind === 'achievement');
  const vio = (cls.types || []).filter(t => t.kind === 'violation');
  body.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div class="row-flex" style="align-items:center;gap:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="muted">Đang quản lý lớp:</span>
          <select id="admin-class-sel" class="filter-sel">${S.classes.map(c => `<option value="${c.id}" ${S.currentClassId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        </div>
        <div style="flex:1"></div>
        <button class="btn" id="cl-add"><i class="fa-solid fa-plus"></i> Thêm lớp</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin-top:0"><i class="fa-solid fa-school"></i> Danh sách lớp</h3>
      <table class="tbl"><thead><tr><th>Tên lớp</th><th>Năm học</th><th>Khối</th><th>Số tuần</th><th>Giáo viên quản lý</th><th class="actions"></th></tr></thead>
      <tbody>${S.classes.map(c => `<tr class="${S.currentClassId === c.id ? 'row-active' : ''}">
        <td><b>${esc(c.name)}</b> ${S.currentClassId === c.id ? '<span class="tag">đang chọn</span>' : ''}</td>
        <td>${esc(c.schoolYear)}</td>
        <td>Khối ${c.grade}</td>
        <td>${c.weeks} tuần</td>
        <td>${(c.managerIds || []).map(id => { const m = teachers.find(t => t.id === id); return `<span class="tag">${esc(m ? m.name : 'GV')}</span>`; }).join(' ') || '<span class="muted">Chưa có</span>'}</td>
        <td class="actions">
          <button class="btn sm primary" data-cl-activate="${c.id}" ${S.currentClassId === c.id ? 'disabled' : ''}><i class="fa-solid fa-check"></i> Chọn</button>
          <button class="btn sm secondary" data-cl-edit="${c.id}"><i class="fa-solid fa-pen"></i> Sửa</button>
          <button class="btn sm red" data-cl-del="${c.id}"><i class="fa-solid fa-trash-can"></i></button>
        </td></tr>`).join('')}</tbody></table>
    </div>
    <div class="card">
      <h3 style="margin-top:0"><i class="fa-solid fa-book"></i> Cài đặt năm học — <span class="muted">${esc(cls.name)}</span></h3>
      <div class="row-flex">
        <div style="flex:1"><label class="f">Năm học</label><input type="text" id="cl-year" value="${esc(cls.schoolYear)}"></div>
        <div style="flex:1"><label class="f">Tên lớp</label><input type="text" id="cl-name" value="${esc(cls.name)}"></div>
      </div>
      <div class="row-flex">
        <div style="flex:1"><label class="f">Khối</label><select id="cl-grade">${[6, 7, 8, 9, 10, 11, 12].map(k => `<option value="${k}" ${cls.grade === k ? 'selected' : ''}>Khối ${k}</option>`).join('')}</select></div>
        <div style="flex:1"><label class="f">Số tuần năm học</label><input type="number" id="cl-weeks" min="1" max="60" value="${cls.weeks}"></div>
      </div>
      <label class="f">Ngày bắt đầu năm học (tuần 1)</label><input type="date" id="cl-start" value="${cls.startDate}">
      <div class="row-flex">
        <div style="flex:1"><label class="f">Điểm mặc định/tuần — học sinh</label><input type="number" id="cl-basestu" min="0" value="${cls.baseStudentWeek}"></div>
        <div style="flex:1"><label class="f">Điểm mặc định/tuần — cả lớp</label><input type="number" id="cl-basecls" min="0" value="${cls.baseClassWeek}"></div>
      </div>
      <div style="text-align:right;margin-top:12px"><button class="btn" id="cl-save"><i class="fa-solid fa-floppy-disk"></i> Lưu cài đặt lớp</button></div>
    </div>
    <h3 style="margin-top:18px"><i class="fa-solid fa-trophy"></i> Loại điểm — <span class="muted">${esc(cls.name)}</span></h3>
    <p class="muted" style="margin-top:0">Các loại thành tích/vi phạm dưới đây thuộc riêng lớp <b>${esc(cls.name)}</b> (${esc(cls.schoolYear)}).</p>
    <div class="grid2">
      <div class="card">
        <h3 style="margin-top:0"><i class="fa-solid fa-trophy"></i> Loại thành tích (điểm cộng)</h3>
        <div style="margin-bottom:10px"><button class="btn green" data-type-add="achievement"><i class="fa-solid fa-plus"></i> Thêm loại thành tích</button></div>
        <table class="tbl"><thead><tr><th>Tên</th><th>Điểm cộng</th><th class="actions"></th></tr></thead>
        <tbody>${ach.map(t => `<tr><td>${esc(t.name)}</td><td><b>+${t.points}</b></td>
          <td class="actions"><button class="btn sm secondary" data-type-edit="${t.id}"><i class="fa-solid fa-pen"></i></button> <button class="btn sm red" data-type-del="${t.id}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Chưa có loại nào.</td></tr>'}</tbody></table>
      </div>
      <div class="card">
        <h3 style="margin-top:0"><i class="fa-solid fa-triangle-exclamation"></i> Loại vi phạm (điểm trừ)</h3>
        <div style="margin-bottom:10px"><button class="btn red" data-type-add="violation"><i class="fa-solid fa-plus"></i> Thêm loại vi phạm</button></div>
        <table class="tbl"><thead><tr><th>Tên</th><th>Điểm trừ</th><th class="actions"></th></tr></thead>
        <tbody>${vio.map(t => `<tr><td>${esc(t.name)}</td><td><b>-${t.points}</b></td>
          <td class="actions"><button class="btn sm secondary" data-type-edit="${t.id}"><i class="fa-solid fa-pen"></i></button> <button class="btn sm red" data-type-del="${t.id}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Chưa có loại nào.</td></tr>'}</tbody></table>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-top:0"><i class="fa-solid fa-users-gear"></i> Giáo viên quản lý — <span class="muted">${esc(cls.name)}</span></h3>
      <div>${teachers.map(t => `
        <label class="chk" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <input type="checkbox" class="mgr-cb" value="${t.id}" ${(cls.managerIds || []).includes(t.id) ? 'checked' : ''}>
          <span>${esc(t.name)} (${esc(t.username)})</span>
        </label>`).join('') || '<p class="muted">Chưa có giáo viên. Hãy thêm giáo viên ở mục Quản trị → Giáo viên.</p>'}</div>
      <div style="text-align:right;margin-top:12px"><button class="btn" id="mgr-save"><i class="fa-solid fa-floppy-disk"></i> Lưu giáo viên quản lý</button></div>
    </div>`;

  document.getElementById('admin-class-sel').onchange = async e => {
    try { await switchClass(e.target.value); refresh(); } catch (err) { toast(err.message, 'err'); }
  };
  document.getElementById('cl-add').onclick = () => classModal(null, refresh);
  body.querySelectorAll('[data-cl-activate]').forEach(b => b.onclick = async () => {
    try { await switchClass(b.dataset.clActivate); toast('Đã chuyển lớp', 'ok'); refresh(); } catch (e) { toast(e.message, 'err'); }
  });
  body.querySelectorAll('[data-cl-edit]').forEach(b => b.onclick = () => classModal(S.classes.find(c => c.id === Number(b.dataset.clEdit)), refresh));
  body.querySelectorAll('[data-cl-del]').forEach(b => b.onclick = async () => {
    const c = S.classes.find(x => x.id === Number(b.dataset.clDel));
    if (!c) return;
    if (await confirmDlg(`Xóa lớp ${esc(c.name)}? Không thể xóa lớp duy nhất.`)) {
      try {
        await api('/classes/' + c.id, { method: 'DELETE' });
        const { loadBootstrap } = await import('../core/state.js');
        await loadBootstrap();
        toast('Đã xóa', 'ok'); refresh();
      } catch (e) { toast(e.message, 'err'); }
    }
  });
  body.querySelectorAll('[data-type-add]').forEach(b => b.onclick = () => typeModal(cls, { kind: b.dataset.typeAdd }, refresh));
  body.querySelectorAll('[data-type-edit]').forEach(b => b.onclick = () => typeModal(cls, cls.types.find(t => t.id === Number(b.dataset.typeEdit)), refresh));
  body.querySelectorAll('[data-type-del]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa loại này? Các bản ghi cũ sẽ mất tham chiếu tên.')) {
      try { await api('/types/' + b.dataset.typeDel, { method: 'DELETE' }); await switchClass(cls.id); toast('Đã xóa', 'ok'); refresh(); } catch (e) { toast(e.message, 'err'); }
    }
  });

  document.getElementById('mgr-save').onclick = async () => {
    const ids = [...body.querySelectorAll('.mgr-cb:checked')].map(cb => Number(cb.value));
    try {
      await api('/classes/' + cls.id + '/managers', { method: 'PUT', body: { managerIds: ids } });
      const { loadBootstrap } = await import('../core/state.js');
      await loadBootstrap();
      toast('Đã lưu giáo viên quản lý', 'ok');
      refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function typeModal(cls, item, onDone) {
  const isAdd = !item || !item.id;
  const kind = isAdd ? item.kind : item.kind;
  const m = openModal({
    title: isAdd ? (kind === 'achievement' ? 'Thêm loại thành tích' : 'Thêm loại vi phạm') + ` — ${esc(cls.name)}` : 'Sửa loại',
    body: `
      <label class="f">Tên</label><input type="text" id="tp-name" value="${esc(isAdd ? '' : item.name)}">
      <label class="f">Số điểm ${isAdd ? '' : (item.kind === 'achievement' ? 'cộng' : 'trừ')} mỗi lần</label>
      <input type="number" id="tp-points" min="1" value="${isAdd ? 1 : item.points}">
      <div class="muted" style="margin-top:6px">Lưu vào lớp <b>${esc(cls.name)}</b></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn secondary" id="tp-cancel">Hủy</button>
        <button class="btn" id="tp-save">Lưu</button></div>`
  });
  m.el.querySelector('#tp-cancel').onclick = m.close;
  m.el.querySelector('#tp-save').onclick = async () => {
    const body = { name: m.el.querySelector('#tp-name').value, points: Number(m.el.querySelector('#tp-points').value) };
    try {
      if (isAdd) await api('/types', { method: 'POST', body: { ...body, kind } });
      else await api('/types/' + item.id, { method: 'PUT', body });
      await switchClass(cls.id);
      toast('Đã lưu loại', 'ok');
      m.close();
      onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function renderTeachersTab(body, teachers) {
  body.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0"><i class="fa-solid fa-chalkboard-user"></i> Tài khoản giáo viên</h3>
      <div style="margin-bottom:10px"><button class="btn" id="tc-add"><i class="fa-solid fa-user-plus"></i> Thêm giáo viên</button></div>
      <table class="tbl"><thead><tr><th>Tên</th><th>Tài khoản</th><th class="actions"></th></tr></thead>
      <tbody>${teachers.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.username)}</td>
        <td class="actions"><button class="btn sm secondary" data-tc-pw="${t.id}"><i class="fa-solid fa-key"></i> Đổi MK</button> <button class="btn sm red" data-tc-del="${t.id}"><i class="fa-solid fa-trash-can"></i></button></td></tr>`).join('')}</tbody></table>
    </div>`;
  const refresh = () => render(document.getElementById('view'));
  document.getElementById('tc-add').onclick = () => teacherModal(null, refresh);
  body.querySelectorAll('[data-tc-del]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa tài khoản giáo viên này?')) {
      try { await api('/users/' + b.dataset.tcDel, { method: 'DELETE' }); toast('Đã xóa', 'ok'); refresh(); } catch (e) { toast(e.message, 'err'); }
    }
  });
  body.querySelectorAll('[data-tc-pw]').forEach(b => b.onclick = () => teacherModal(teachers.find(t => t.id === Number(b.dataset.tcPw)), refresh));
}

function teacherModal(item, onDone) {
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
      onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function classModal(item, onDone) {
  const isAdd = !item;
  const m = openModal({
    title: isAdd ? 'Thêm lớp mới' : `Sửa lớp ${esc(item.name)}`,
    wide: true,
    body: `
      <div class="row-flex">
        <div style="flex:1"><label class="f">Tên lớp</label><input type="text" id="cl-name" value="${esc(isAdd ? '' : item.name)}"></div>
        <div style="flex:1"><label class="f">Năm học</label><input type="text" id="cl-year" placeholder="VD: 2025-2026" value="${esc(isAdd ? '' : item.schoolYear)}"></div>
      </div>
      <div class="row-flex">
        <div style="flex:1"><label class="f">Khối</label><select id="cl-grade">${[6, 7, 8, 9, 10, 11, 12].map(k => `<option value="${k}" ${(isAdd ? 12 : item.grade) === k ? 'selected' : ''}>Khối ${k}</option>`).join('')}</select></div>
        <div style="flex:1"><label class="f">Số tuần năm học</label><input type="number" id="cl-weeks" min="1" max="60" value="${isAdd ? 36 : item.weeks}"></div>
      </div>
      <label class="f">Ngày bắt đầu năm học (tuần 1)</label><input type="date" id="cl-start" value="${isAdd ? '' : item.startDate}">
      <div class="row-flex">
        <div style="flex:1"><label class="f">Điểm mặc định/tuần — học sinh</label><input type="number" id="cl-basestu" min="0" value="${isAdd ? 0 : item.baseStudentWeek}"></div>
        <div style="flex:1"><label class="f">Điểm mặc định/tuần — cả lớp</label><input type="number" id="cl-basecls" min="0" value="${isAdd ? 0 : item.baseClassWeek}"></div>
      </div>
      <div class="muted" style="margin-top:6px">Lớp mới sẽ kế thừa danh sách loại điểm từ lớp hiện tại.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn secondary" id="cl-cancel">Hủy</button>
        <button class="btn" id="cl-save">Lưu</button></div>`
  });
  m.el.querySelector('#cl-cancel').onclick = m.close;
  m.el.querySelector('#cl-save').onclick = async () => {
    const body = {
      name: m.el.querySelector('#cl-name').value,
      schoolYear: m.el.querySelector('#cl-year').value,
      grade: Number(m.el.querySelector('#cl-grade').value),
      weeks: Number(m.el.querySelector('#cl-weeks').value),
      startDate: m.el.querySelector('#cl-start').value,
      baseStudentWeek: Number(m.el.querySelector('#cl-basestu').value),
      baseClassWeek: Number(m.el.querySelector('#cl-basecls').value)
    };
    try {
      if (isAdd) await api('/classes', { method: 'POST', body });
      else await api('/classes/' + item.id, { method: 'PUT', body });
      toast('Đã lưu lớp', 'ok');
      m.close();
      onDone();
    } catch (e) { toast(e.message, 'err'); }
  };
}

registerRoute('admin', { title: 'Quản trị', icon: 'fa-gear', access: p => p.admin, render });
