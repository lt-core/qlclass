import { S } from '../core/state.js';
import { registerRoute } from '../core/router.js';
import { render as renderLabor } from '../student/labor.js';
import { render as renderCulture } from '../student/culture.js';

async function render(view) {
  const tab = S.lifeTab;
  view.innerHTML = `
    <h2 class="page-title">Đời sống</h2>
    <p class="page-sub">Hoạt động lao động và văn thể của lớp theo từng tuần.</p>
    <div class="subtabs">
      <button data-tab="labor" class="${tab === 'labor' ? 'active' : ''}"><i class="fa-solid fa-broom"></i> Lao động</button>
      <button data-tab="culture" class="${tab === 'culture' ? 'active' : ''}"><i class="fa-solid fa-masks-theater"></i> Văn thể</button>
    </div>
    <div id="life-body"></div>`;
  view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    S.lifeTab = b.dataset.tab;
    render(view);
  });
  if (tab === 'labor') renderLabor(document.getElementById('life-body'));
  else renderCulture(document.getElementById('life-body'));
}

registerRoute('life', { title: 'Đời sống', icon: 'fa-heart', access: p => p.viewClass, render });
