export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function mdToHtml(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  let html = '', inCode = false, listType = null, para = [];
  const closeList = () => { if (listType) { html += listType === 'ul' ? '</ul>' : '</ol>'; listType = null; } };
  const flushPara = () => {
    if (para.length) { html += '<p>' + inline(para.join('<br>')) + '</p>'; para = []; }
  };
  function inline(t) {
    return t
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  for (const raw of lines) {
    if (/^```/.test(raw.trim())) {
      flushPara(); closeList();
      html += inCode ? '</code></pre>' : '<pre><code>';
      inCode = !inCode;
      continue;
    }
    if (inCode) { html += escapeHtml(raw) + '\n'; continue; }
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); closeList(); continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flushPara(); closeList();
      const lv = m[1].length;
      html += `<h${lv}>` + inline(escapeHtml(m[2])) + `</h${lv}>`;
      continue;
    }
    if ((m = /^[-*]\s+(.*)$/.exec(line))) {
      flushPara();
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += '<li>' + inline(escapeHtml(m[1])) + '</li>';
      continue;
    }
    if ((m = /^\d+\.\s+(.*)$/.exec(line))) {
      flushPara();
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += '<li>' + inline(escapeHtml(m[1])) + '</li>';
      continue;
    }
    if ((m = /^>\s?(.*)$/.exec(line))) {
      flushPara(); closeList();
      html += '<blockquote>' + inline(escapeHtml(m[1])) + '</blockquote>';
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); closeList(); html += '<hr>'; continue; }
    para.push(escapeHtml(line));
  }
  flushPara(); closeList();
  if (inCode) html += '</code></pre>';
  return html;
}
