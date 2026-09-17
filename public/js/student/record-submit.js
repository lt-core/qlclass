import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, toast, openModal } from '../core/ui.js';

export function renderSubmitButton(btnEl, onDone) {
  btnEl.onclick = async () => {
    const students = await api('/students', { silent: true });
    const meSt = S.student;
    const scope = students.filter(s => s.groupId === (meSt || {}).groupId);
    if (!scope.length) { toast('Không có học sinh nào trong tổ của bạn', 'err'); return; }
    const achTypes = S.types.filter(t => t.kind === 'achievement');
    const vioTypes = S.types.filter(t => t.kind === 'violation');
    const typeOpts = t => `<option value="${t.id}">${t.kind === 'achievement' ? '+' : '-'} ${esc(t.name)} (${t.points})</option>`;

    const draft = [];
    const m = openModal({
      title: `Tổ trưởng ghi nhận — Tuần ${S.week}`,
      wide: true,
      body: `
        <div class="row-flex" style="align-items:end">
          <div style="flex:1.2"><label class="f">Học sinh</label><select id="rc-student">${scope.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
          <div style="flex:1.5"><label class="f">Loại</label><select id="rc-type">
            <optgroup label="Thành tích">${achTypes.map(typeOpts).join('')}</optgroup>
            <optgroup label="Vi phạm">${vioTypes.map(typeOpts).join('')}</optgroup>
          </select></div>
          <div style="flex:2"><label class="f">Ghi chú</label><input type="text" id="rc-note" placeholder="Mô tả ngắn..."></div>
          <div class="rc-count"><label class="f">Số lần</label><input type="number" id="rc-count" min="1" max="100" value="1"></div>
          <button class="btn secondary" id="rc-add"><i class="fa-solid fa-plus"></i> Thêm</button>
        </div>
        <div id="rc-list"></div>
        <div class="muted" style="margin-top:6px">Ghi nhận vào <b>Tuần ${S.week}</b> • sẽ ở trạng thái <b>chờ giáo viên duyệt</b>. Có thể thêm trùng loại nhiều lần.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn secondary" id="rc-cancel">Hủy</button>
          <button class="btn" id="rc-send" disabled>Gửi cho giáo viên duyệt</button></div>`
    });

    const listEl = m.el.querySelector('#rc-list');
    const sendBtn = m.el.querySelector('#rc-send');

    const renderDraft = () => {
      listEl.innerHTML = draft.length ? draft.map((d, i) => `
        <div class="rc-row">
          <span><b>${esc(d.name)}</b></span>
          <span class="tag ${d.kind === 'achievement' ? 'green' : 'red'}">${d.kind === 'achievement' ? '+' : '−'} ${esc(d.typeName)} (${d.points})</span>
          ${d.count > 1 ? `<span class="tag blue">×${d.count}</span>` : ''}
          ${d.note ? `<span class="muted rc-note">${esc(d.note)}</span>` : ''}
          <button class="btn sm red" data-rm="${i}" title="Bỏ mục này"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('') : '<div class="empty" style="padding:12px">Chưa có mục nào — chọn học sinh & loại ở trên rồi bấm <b>Thêm</b>.</div>';
      listEl.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
        draft.splice(Number(b.dataset.rm), 1);
        renderDraft();
      });
      const total = draft.reduce((t, d) => t + d.count, 0);
      const ach = draft.reduce((t, d) => t + (d.kind === 'achievement' ? d.count : 0), 0);
      const vio = total - ach;
      sendBtn.disabled = total === 0;
      sendBtn.innerHTML = `Gửi cho giáo viên duyệt (${total}) <span class="muted">${ach ? '+' + ach : ''}${ach && vio ? ' / ' : ''}${vio ? '−' + vio : ''}</span>`;
    };
    renderDraft();

    m.el.querySelector('#rc-add').onclick = () => {
      const sid = Number(m.el.querySelector('#rc-student').value);
      const tid = Number(m.el.querySelector('#rc-type').value);
      const note = m.el.querySelector('#rc-note').value.trim();
      const countEl = m.el.querySelector('#rc-count');
      const count = Math.min(Math.max(Number(countEl.value) || 1, 1), 100);
      const st = scope.find(s => s.id === sid);
      const t = S.types.find(x => x.id === tid);
      if (!st || !t) return;
      const same = draft.find(d => d.sid === sid && d.tid === tid && d.note === note);
      if (same) same.count += count;
      else draft.push({ sid, tid, note, count, name: st.name, kind: t.kind, typeName: t.name, points: t.points });
      m.el.querySelector('#rc-note').value = '';
      countEl.value = 1;
      renderDraft();
    };
    m.el.querySelector('#rc-note').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); m.el.querySelector('#rc-add').click(); }
    });
    m.el.querySelector('#rc-cancel').onclick = m.close;
    sendBtn.onclick = async () => {
      const items = draft.flatMap(d => Array.from({ length: d.count }, () => ({ studentId: d.sid, typeId: d.tid, note: d.note, week: S.week })));
      if (!items.length) return;
      try {
        await api('/records/batch', { method: 'POST', body: { items } });
        toast(`Đã gửi ${items.length} mục chờ giáo viên duyệt`, 'ok');
        m.close();
        onDone();
      } catch (e) { toast(e.message, 'err'); }
    };
  };
}