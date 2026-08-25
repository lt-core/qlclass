import { api } from '../core/http.js';
import { esc, toast, openModal } from '../core/ui.js';
import { createEditor } from '../core/editor.js';

export function openAnModal(item, done) {
  const m = openModal({
    title: item ? 'Sửa thông báo' : 'Thêm thông báo',
    wide: true,
    body: `
      <label class="f">Tiêu đề</label><input type="text" id="an-title" value="${esc(item ? item.title : '')}">
      <div class="row-flex" style="align-items:end">
        <div style="flex:1"><label class="f">Gửi đến</label>
          <select id="an-aud">
            <option value="all" ${item && item.audience === 'all' ? 'selected' : ''}>Tất cả</option>
            <option value="students" ${item && item.audience === 'students' ? 'selected' : ''}>Học sinh</option>
            <option value="teachers" ${item && item.audience === 'teachers' ? 'selected' : ''}>Giáo viên</option>
          </select></div>
        <div style="flex:1"><label class="f">Tự động hết hạn (tùy chọn)</label><input type="datetime-local" id="an-exp" value="${item && item.expiresAt ? item.expiresAt.slice(0, 16) : ''}"></div>
      </div>
      <label class="f">Nội dung</label>
      <div id="an-editor"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn secondary" id="an-cancel">Hủy</button>
        <button class="btn" id="an-save">Lưu thông báo</button></div>`
  });
  const editor = createEditor(m.el.querySelector('#an-editor'), { placeholder: 'Soạn nội dung thông báo...', height: '180px' });
  if (item && item.content) editor.setContents(item.content);
  m.el.querySelector('#an-cancel').onclick = m.close;
  m.el.querySelector('#an-save').onclick = async () => {
    const expRaw = m.el.querySelector('#an-exp').value;
    const body = {
      title: m.el.querySelector('#an-title').value,
      audience: m.el.querySelector('#an-aud').value,
      content: editor.getHTML(),
      expiresAt: expRaw ? new Date(expRaw).toISOString() : null
    };
    try {
      if (item) await api('/announcements/' + item.id, { method: 'PUT', body });
      else await api('/announcements', { method: 'POST', body });
      toast('Đã lưu thông báo', 'ok');
      m.close();
      done();
    } catch (e) { toast(e.message, 'err'); }
  };
}
