import { api } from '../core/http.js';
import { S, POS_LABEL } from '../core/state.js';
import { esc, toast, confirmDlg, fmtDate, openModal } from '../core/ui.js';
import { registerRoute, applyRouter } from '../core/router.js';

async function render(view) {
  const [groups, students] = await Promise.all([api('/groups'), api('/students')]);
  S.groups = groups;
  const unseated = students.filter(s => s.row === null || s.col === null);

  const chipHtml = st => `
    <div class="stu-chip${S.selSid === st.id ? ' selected' : ''}" draggable="true" data-sid="${st.id}" title="${esc(st.name)}">
      ${st.photo ? `<img src="${esc(st.photo)}">` : ''}
      <span>${esc(st.name)}</span>
      ${st.position && st.position !== 'thanh_vien' ? `<span class="pos">${POS_LABEL[st.position]}</span>` : ''}
    </div>`;

  const selGid = groups.some(g => g.id === S.selGid) ? S.selGid : (groups[0] ? groups[0].id : null);
  S.selGid = selGid;

  const gItemHtml = g => {
    const gs = students.filter(s => s.groupId === g.id);
    const filled = gs.filter(s => s.row !== null && s.col !== null).length;
    return `<button type="button" class="g-item${g.id === selGid ? ' active' : ''}" data-gsel="${g.id}">
      <span class="gi-top"><span class="gi-name">${esc(g.name)}</span>${g.id === selGid ? '<i class="fa-solid fa-circle-check"></i>' : ''}</span>
      <span class="gi-sub">${gs.length} học sinh • ${filled}/${g.rows * g.cols} chỗ</span>
    </button>`;
  };

  view.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-school"></i> Lớp học</h2>
    <p class="page-sub">Quản lý tổ, sơ đồ chỗ ngồi (kéo-thả hoặc chọn học sinh rồi bấm chỗ) và danh sách học sinh.</p>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn" id="gr-add"><i class="fa-solid fa-plus"></i> Thêm tổ</button>
      <button class="btn secondary" id="st-add"><i class="fa-solid fa-user-plus"></i> Thêm học sinh</button>
    </div>
    ${groups.length ? `<div class="group-strip">${groups.map(gItemHtml).join('')}</div>` : ''}
    <div id="seating">
      ${(() => {
        const g = groups.find(x => x.id === selGid);
        if (!g) return '<div class="empty">Chưa có tổ nào — bấm "Thêm tổ" để bắt đầu</div>';
        const gs = students.filter(s => s.groupId === g.id);
        return `<div class="card"><div class="group-head">
          <h4><i class="fa-solid fa-table-cells-large"></i> ${esc(g.name)}</h4>
          <span class="muted">${g.rows}×${g.cols} • ${gs.filter(s => s.row !== null && s.col !== null).length}/${g.rows * g.cols} chỗ</span>
          <span style="flex:1"></span>
          <button class="btn sm secondary" data-gr-edit="${g.id}"><i class="fa-solid fa-gear"></i> Sửa tổ</button>
          <button class="btn sm red" data-gr-del="${g.id}">Xóa tổ</button>
        </div>
        <div class="seat-grid" style="grid-template-columns:repeat(${g.cols},1fr)">
          ${Array.from({ length: g.rows * g.cols }, (_, i) => {
            const r = Math.floor(i / g.cols), c = i % g.cols;
            const st = gs.find(s => s.row === r && s.col === c);
            return `<div class="seat ${st ? '' : 'empty'}" data-gid="${g.id}" data-row="${r}" data-col="${c}" data-pos-label="(${r + 1},${c + 1})">${st ? chipHtml(st) : ''}</div>`;
          }).join('')}
        </div></div>`;
      })()}
    </div>
    <div class="card"><h3><i class="fa-solid fa-inbox"></i> Chưa xếp chỗ (${unseated.length})</h3>
      <div class="pool">${unseated.map(chipHtml).join('') || '<span class="muted">Tất cả đã có chỗ</span>'}</div>
    </div>
    <div class="card"><h3><i class="fa-solid fa-users"></i> Danh sách học sinh (${students.length})</h3>
      <table class="tbl"><thead><tr><th></th><th>Tên</th><th>Ngày sinh</th><th>GT</th><th>Chức vụ</th><th>Tổ</th><th>Chỗ</th><th>Địa chỉ</th><th class="actions">Tài khoản & thao tác</th></tr></thead>
      <tbody>${students.map(st => {
        const g = groups.find(x => x.id === st.groupId) || {};
        return `<tr>
          <td>${st.photo ? `<img class="photo-prev" src="${esc(st.photo)}">` : '<div class="photo-prev" style="background:#f1f5f9"></div>'}</td>
          <td><b>${esc(st.name)}</b></td><td>${fmtDate(st.dob)}</td><td>${esc(st.gender)}</td>
          <td><span class="tag ${st.position === 'thanh_vien' ? 'gray' : 'blue'}">${POS_LABEL[st.position]}</span></td>
          <td>${esc(g.name || '')}</td><td>${(st.row !== null && st.col !== null) ? `(${st.row + 1},${st.col + 1})` : '—'}</td>
          <td class="muted">${esc(st.address)}</td>
          <td class="actions">
            <button class="btn sm secondary" data-st-edit="${st.id}" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            <button class="btn sm secondary" data-st-acc="${st.id}" title="Tài khoản"><i class="fa-solid fa-key"></i></button>
            <button class="btn sm red" data-st-del="${st.id}" title="Xóa"><i class="fa-solid fa-trash-can"></i></button>
          </td></tr>`;
      }).join('')}</tbody></table>
    </div>`;

  document.getElementById('gr-add').onclick = () => groupModal(null);
  document.getElementById('st-add').onclick = () => studentModal(null);
  view.querySelectorAll('[data-gsel]').forEach(b => b.onclick = () => {
    S.selGid = Number(b.dataset.gsel);
    S.selSid = null;
    rerender();
  });
  view.querySelectorAll('[data-gr-del]').forEach(b => b.onclick = async () => {
    if (await confirmDlg('Xóa tổ này? (Tổ phải trống học sinh)')) {
      try { await api('/groups/' + b.dataset.grDel, { method: 'DELETE' }); toast('Đã xóa tổ', 'ok'); rerender(); } catch (e) { toast(e.message, 'err'); }
    }
  });
  view.querySelectorAll('[data-gr-edit]').forEach(b => b.onclick = () => groupModal(groups.find(g => g.id === Number(b.dataset.grEdit))));
  view.querySelectorAll('[data-st-edit]').forEach(b => b.onclick = () => studentModal(students.find(s => s.id === Number(b.dataset.stEdit))));
  view.querySelectorAll('[data-st-del]').forEach(b => b.onclick = async () => {
    const st = students.find(s => s.id === Number(b.dataset.stDel));
    if (await confirmDlg(`Xóa học sinh "${st.name}"? Toàn bộ dữ liệu liên quan sẽ bị xóa.`)) {
      try { await api('/students/' + st.id, { method: 'DELETE' }); toast('Đã xóa học sinh', 'ok'); rerender(); } catch (e) { toast(e.message, 'err'); }
    }
  });
  view.querySelectorAll('[data-st-acc]').forEach(b => b.onclick = () => accModal(students.find(s => s.id === Number(b.dataset.stAcc))));

  let dragSid = null;
  let touchGhost = null;
  let touchStartPos = null;
  let touchDragging = false;

  view.querySelectorAll('.stu-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      dragSid = Number(chip.dataset.sid);
      chip.classList.add('dragging');
      e.dataTransfer.setData('text/plain', String(dragSid));
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => { chip.classList.remove('dragging'); dragSid = null; });

    chip.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      touchDragging = false;
      dragSid = Number(chip.dataset.sid);
    }, { passive: true });

    chip.addEventListener('touchmove', e => {
      if (dragSid === null) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.x;
      const dy = touch.clientY - touchStartPos.y;

      if (!touchDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        touchDragging = true;
        chip.classList.add('dragging');
        touchGhost = chip.cloneNode(true);
        touchGhost.classList.add('touch-ghost');
        touchGhost.style.cssText = 'position:fixed;z-index:99998;pointer-events:none;opacity:.85;transform:scale(1.05);transition:none';
        document.body.appendChild(touchGhost);
      }

      if (touchGhost) {
        touchGhost.style.left = (touch.clientX - 40) + 'px';
        touchGhost.style.top = (touch.clientY - 25) + 'px';
      }

      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      view.querySelectorAll('.seat').forEach(s => s.classList.remove('drop-hover'));
      if (el) {
        const seat = el.closest('.seat');
        if (seat) seat.classList.add('drop-hover');
      }

      if (touchDragging) e.preventDefault();
    }, { passive: false });

    chip.addEventListener('touchend', e => {
      chip.classList.remove('dragging');
      if (touchGhost) { touchGhost.remove(); touchGhost = null; }
      view.querySelectorAll('.seat').forEach(s => s.classList.remove('drop-hover'));

      if (touchDragging && dragSid !== null) {
        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el) {
          const seat = el.closest('.seat');
          if (seat) placeSeat(dragSid, seat);
        }
      } else if (!touchDragging && dragSid !== null) {
        const sid = dragSid;
        S.selSid = S.selSid === sid ? null : sid;
        rerender();
      }

      dragSid = null;
      touchDragging = false;
      touchStartPos = null;
    });

    chip.addEventListener('click', () => {
      const sid = Number(chip.dataset.sid);
      S.selSid = S.selSid === sid ? null : sid;
      rerender();
    });
  });
  view.querySelectorAll('.seat').forEach(seat => {
    seat.addEventListener('dragover', e => { e.preventDefault(); seat.classList.add('drop-hover'); });
    seat.addEventListener('dragleave', () => seat.classList.remove('drop-hover'));
    seat.addEventListener('drop', e => {
      e.preventDefault();
      seat.classList.remove('drop-hover');
      const sid = Number(e.dataTransfer.getData('text/plain')) || dragSid;
      if (sid) placeSeat(sid, seat);
    });
    seat.addEventListener('click', () => { if (S.selSid) placeSeat(S.selSid, seat); });
  });

  async function placeSeat(sid, seatEl) {
    try {
      await api(`/students/${sid}/seat`, {
        method: 'PUT',
        body: { groupId: Number(seatEl.dataset.gid), row: Number(seatEl.dataset.row), col: Number(seatEl.dataset.col) }
      });
      S.selSid = null;
      toast('Đã cập nhật chỗ ngồi', 'ok');
      rerender();
    } catch (e) { toast(e.message, 'err'); }
  }

  function groupModal(item) {
    const m = openModal({
      title: item ? 'Sửa tổ' : 'Thêm tổ',
      body: `
        <label class="f">Tên tổ</label><input type="text" id="gr-name" value="${esc(item ? item.name : '')}" placeholder="VD: Tổ 1">
        <div class="row-flex">
          <div style="flex:1"><label class="f">Số hàng (x)</label><input type="number" id="gr-rows" min="1" max="10" value="${item ? item.rows : 2}"></div>
          <div style="flex:1"><label class="f">Chỗ mỗi hàng (n)</label><input type="number" id="gr-cols" min="1" max="10" value="${item ? item.cols : 3}"></div>
        </div>
        <div class="muted" style="margin-top:6px">Ví dụ 6×2 = 6 chỗ mỗi hàng, 2 hàng.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="gr-cancel">Hủy</button>
          <button class="btn" id="gr-save">Lưu</button></div>`
    });
    m.el.querySelector('#gr-cancel').onclick = m.close;
    m.el.querySelector('#gr-save').onclick = async () => {
      const body = {
        name: m.el.querySelector('#gr-name').value,
        rows: Number(m.el.querySelector('#gr-rows').value),
        cols: Number(m.el.querySelector('#gr-cols').value)
      };
      try {
        if (item) await api('/groups/' + item.id, { method: 'PUT', body });
        else await api('/groups', { method: 'POST', body });
        toast('Đã lưu tổ', 'ok');
        m.close();
        rerender();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  function accModal(st) {
    const m = openModal({
      title: 'Tài khoản đăng nhập — ' + esc(st.name),
      body: `
        <label class="f">Tên đăng nhập</label><input type="text" id="ac-user">
        <label class="f">Mật khẩu</label><input type="text" id="ac-pass">
        <div class="muted" style="margin-top:6px">Tạo/cập nhật tài khoản để học sinh đăng nhập với chức vụ hiện có.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="ac-cancel">Hủy</button>
          <button class="btn" id="ac-save">Lưu tài khoản</button></div>`
    });
    m.el.querySelector('#ac-cancel').onclick = m.close;
    m.el.querySelector('#ac-save').onclick = async () => {
      try {
        await api(`/students/${st.id}/account`, {
          method: 'POST',
          body: { username: m.el.querySelector('#ac-user').value.trim(), password: m.el.querySelector('#ac-pass').value }
        });
        toast('Đã lưu tài khoản', 'ok');
        m.close();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  function studentModal(item) {
    const m = openModal({
      title: item ? 'Sửa học sinh' : 'Thêm học sinh',
      body: `
        <div class="row-flex" style="margin-bottom:8px">
          <img id="sm-prev" class="photo-prev" src="${item && item.photo ? esc(item.photo) : ''}" style="${item && item.photo ? '' : 'display:none'}">
          <div style="flex:1">
            <label class="f">Ảnh (upload)</label>
            <input type="file" id="sm-photo" accept="image/*">
            <input type="hidden" id="sm-photo-url" value="${item ? esc(item.photo) : ''}">
          </div>
        </div>
        <label class="f">Họ tên</label><input type="text" id="sm-name" value="${esc(item ? item.name : '')}">
        <div class="row-flex">
          <div style="flex:1"><label class="f">Ngày sinh</label><input type="date" id="sm-dob" value="${item ? item.dob : ''}"></div>
          <div style="flex:1"><label class="f">Giới tính</label><select id="sm-gender"><option ${item && item.gender === 'Nam' ? 'selected' : ''}>Nam</option><option ${item && item.gender === 'Nữ' ? 'selected' : ''}>Nữ</option></select></div>
        </div>
        <label class="f">Địa chỉ</label><input type="text" id="sm-address" value="${esc(item ? item.address : '')}">
        <div class="row-flex">
          <div style="flex:1"><label class="f">Tổ</label><select id="sm-group">${groups.map(g => `<option value="${g.id}" ${item && item.groupId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></div>
          <div style="flex:1"><label class="f">Chức vụ</label><select id="sm-pos">${Object.entries(POS_LABEL).map(([k, v]) => `<option value="${k}" ${item && item.position === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="sm-cancel">Hủy</button>
          <button class="btn" id="sm-save">Lưu</button></div>`
    });
    m.el.querySelector('#sm-photo').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          toast('Đang tải ảnh lên...');
          const r = await api('/upload', { method: 'POST', body: { dataUrl: rd.result } });
          m.el.querySelector('#sm-photo-url').value = r.url;
          const pv = m.el.querySelector('#sm-prev');
          pv.src = r.url;
          pv.style.display = 'block';
          toast('Đã tải ảnh', 'ok');
        } catch (er) { toast(er.message, 'err'); }
      };
      rd.readAsDataURL(f);
    };
    m.el.querySelector('#sm-cancel').onclick = m.close;
    m.el.querySelector('#sm-save').onclick = async () => {
      const body = {
        name: m.el.querySelector('#sm-name').value,
        dob: m.el.querySelector('#sm-dob').value,
        gender: m.el.querySelector('#sm-gender').value,
        address: m.el.querySelector('#sm-address').value,
        photo: m.el.querySelector('#sm-photo-url').value,
        groupId: Number(m.el.querySelector('#sm-group').value),
        position: m.el.querySelector('#sm-pos').value
      };
      try {
        if (item) await api('/students/' + item.id, { method: 'PUT', body });
        else await api('/students', { method: 'POST', body });
        toast('Đã lưu học sinh', 'ok');
        m.close();
        rerender();
      } catch (e) { toast(e.message, 'err'); }
    };
  }

  function rerender() {
    S.selSid = null;
    applyRouter();
  }
}

registerRoute('classroom', { title: 'Lớp học', icon: 'fa-school', access: p => p.manageGroups, render });
