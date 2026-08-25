import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, toast, openModal } from '../core/ui.js';

export function renderSubmitButton(btnEl, onDone) {
  btnEl.onclick = async () => {
    const students = await api('/students');
    const meSt = S.student;
    const scope = students.filter(s => s.groupId === (meSt || {}).groupId);
    if (!scope.length) { toast('Không có học sinh nào trong tổ của bạn', 'err'); return; }
    const achTypes = S.types.filter(t => t.kind === 'achievement');
    const vioTypes = S.types.filter(t => t.kind === 'violation');
    const m = openModal({
      title: `Tổ trưởng ghi nhận — Tuần ${S.week}`,
      body: `
        <label class="f">Học sinh trong tổ</label>
        <select id="rc-student">${scope.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        <label class="f">Loại</label><select id="rc-type">
          <optgroup label="Thành tích">${achTypes.map(t => `<option value="${t.id}">+ ${esc(t.name)} (+${t.points})</option>`).join('')}</optgroup>
          <optgroup label="Vi phạm">${vioTypes.map(t => `<option value="${t.id}">- ${esc(t.name)} (-${t.points})</option>`).join('')}</optgroup>
        </select>
        <label class="f">Ghi chú</label><input type="text" id="rc-note" placeholder="Mô tả ngắn...">
        <div class="muted" style="margin-top:6px">Ghi nhận vào <b>Tuần ${S.week}</b> • sẽ ở trạng thái <b>chờ giáo viên duyệt</b>.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="rc-cancel">Hủy</button>
          <button class="btn" id="rc-save">Gửi cho giáo viên duyệt</button></div>`
    });
    m.el.querySelector('#rc-cancel').onclick = m.close;
    m.el.querySelector('#rc-save').onclick = async () => {
      try {
        await api('/records', {
          method: 'POST',
          body: {
            studentId: Number(m.el.querySelector('#rc-student').value),
            typeId: Number(m.el.querySelector('#rc-type').value),
            note: m.el.querySelector('#rc-note').value,
            week: S.week
          }
        });
        toast('Đã gửi chờ giáo viên duyệt', 'ok');
        m.close();
        onDone();
      } catch (e) { toast(e.message, 'err'); }
    };
  };
}
