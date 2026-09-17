export const THEMES = [
  { id: 'dark', name: 'Vàng kim (tối)', mode: 'dark', a: '#f59e0b', b: '#131009' },
  { id: 'light', name: 'Sáng (vàng kim)', mode: 'light', a: '#f59e0b', b: '#fffdf8' },
  { id: 'ocean', name: 'Đại dương', mode: 'dark', a: '#60a5fa', b: '#0e1a2e' },
  { id: 'forest', name: 'Rừng xanh', mode: 'dark', a: '#4ade80', b: '#0f1c12' },
  { id: 'violet', name: 'Tím mộng', mode: 'dark', a: '#a78bfa', b: '#180f28' },
  { id: 'rose', name: 'Hồng đào', mode: 'dark', a: '#f472b6', b: '#220f19' },
  { id: 'sky', name: 'Bầu trời (sáng)', mode: 'light', a: '#3b82f6', b: '#f7fafd' }
];

const KEY = 'qlc_theme';
const IDS = new Set(THEMES.map(t => t.id));

export function themeMeta(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function themeId() {
  try {
    const v = localStorage.getItem(KEY);
    return IDS.has(v) ? v : 'dark';
  } catch (_) {
    return 'dark';
  }
}

export function applyTheme(id) {
  if (!IDS.has(id)) id = 'dark';
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem(KEY, id); } catch (_) {}
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', themeMeta(id).mode === 'light' ? 'light' : 'dark');
  document.dispatchEvent(new CustomEvent('qlc:theme', { detail: { id } }));
  return id;
}

export function initTheme() {
  return applyTheme(themeId());
}
