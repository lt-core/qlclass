import { api } from '../core/http.js';
import { S } from '../core/state.js';
import { esc, toast, confirmDlg, fmtDate, money } from '../core/ui.js';
import { registerRoute } from '../core/router.js';
import { openTxModal } from '../student/treasury-manage.js';

async function render(view) {
  const { list, balance } = await api('/transactions');
  const can = S.perms.manageTreasury;
  view.innerHTML = `
    <h2 class="page-title"><i class="fa-solid fa-coins"></i> Thủ quỹ</h2>
    <p class="page-sub">Toàn bộ nội dung chi tiêu của lớp.</p>
    <div class="grid2">
      <div class="card stat"><div class="num" style="color:${balance >= 0 ? 'var(--green)' : 'var(--red)'}">${money(balance)}</div><div class="lbl">Số dư quỹ lớp hiện tại</div></div>
      <div class="card stat"><div class="num">${list.length}</div><div class="lbl">Số giao dịch</div></div>
    </div>
    ${can ? `<div style="margin-bottom:14px"><button class="btn" id="tx-add"><i class="fa-solid fa-plus"></i> Thêm giao dịch</button></div>` : ''}
    <div class="card">
      ${list.length ? `<table class="tbl"><thead><tr><th>Ngày</th><th>Nội dung</th><th>Số tiền</th>${can ? '<th></th>' : ''}</tr></thead>
      <tbody>${list.map(t => `<tr>
        <td>${fmtDate(t.date)}</td><td>${esc(t.desc)}</td>
        <td style="color:${t.amount >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700">${t.amount >= 0 ? '+' : ''}${money(t.amount)}</td>
        ${can ? `<td class="actions"><button class="btn sm secondary" data-tx-edit="${t.id}"><i class="fa-solid fa-pen"></i></button> <button class="btn sm red" data-tx-del="${t.id}"><i class="fa-solid fa-trash-can"></i></button></td>` : ''}
      </tr>`).join('')}</tbody></table>` : '<div class="empty">Chưa có giao dịch nào</div>'}
    </div>`;
  if (can) {
    document.getElementById('tx-add').onclick = () => openTxModal(null, () => render(view));
    view.querySelectorAll('[data-tx-del]').forEach(b => b.onclick = async () => {
      if (await confirmDlg('Xóa giao dịch này?')) {
        try { await api('/transactions/' + b.dataset.txDel, { method: 'DELETE' }); toast('Đã xóa', 'ok'); render(view); } catch (e) { toast(e.message, 'err'); }
      }
    });
    view.querySelectorAll('[data-tx-edit]').forEach(b => b.onclick = () => {
      openTxModal(list.find(x => x.id === Number(b.dataset.txEdit)), () => render(view));
    });
  }
}

registerRoute('treasury', { title: 'Thủ quỹ', icon: 'fa-coins', access: p => p.viewClass, render });
