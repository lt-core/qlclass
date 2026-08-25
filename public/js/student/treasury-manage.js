import { api } from '../core/http.js';
import { esc, toast, openModal, todayStr } from '../core/ui.js';

export function openTxModal(item, done) {
  const m = openModal({
    title: item ? 'Sửa giao dịch' : 'Thêm giao dịch',
    body: `
      <label class="f">Loại</label>
      <select id="tx-kind">
        <option value="in" ${item && item.amount >= 0 ? 'selected' : ''}>Thu (+)</option>
        <option value="out" ${item && item.amount < 0 ? 'selected' : ''}>Chi (-)</option>
      </select>
      <label class="f">Số tiền</label>
      <div class="input-suffix"><input type="number" id="tx-amount" min="1" step="1000" value="${item ? Math.abs(item.amount) : ''}" placeholder="0"><span class="suffix">đ</span></div>
      <label class="f">Nội dung</label><input type="text" id="tx-desc" value="${esc(item ? item.desc : '')}">
      <label class="f">Ngày</label><input type="date" id="tx-date" value="${item ? item.date : todayStr()}">
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn secondary" id="tx-cancel">Hủy</button>
        <button class="btn" id="tx-save">Lưu</button></div>`
  });
  m.el.querySelector('#tx-cancel').onclick = m.close;
  m.el.querySelector('#tx-save').onclick = async () => {
    const amt = Math.abs(Number(m.el.querySelector('#tx-amount').value) || 0);
    const body = {
      amount: m.el.querySelector('#tx-kind').value === 'in' ? amt : -amt,
      desc: m.el.querySelector('#tx-desc').value,
      date: m.el.querySelector('#tx-date').value
    };
    try {
      if (item) await api('/transactions/' + item.id, { method: 'PUT', body });
      else await api('/transactions', { method: 'POST', body });
      toast('Đã lưu', 'ok');
      m.close();
      done();
    } catch (e) { toast(e.message, 'err'); }
  };
}
