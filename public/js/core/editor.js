const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  ['link'],
  ['clean']
];

export function createEditor(container, { placeholder = 'Nhập nội dung...', height = '180px' } = {}) {
  if (!window.Quill) {
    console.warn('Quill not loaded');
    const ta = document.createElement('textarea');
    ta.placeholder = placeholder;
    ta.style.cssText = `width:100%;min-height:${height};padding:10px;border:1px solid var(--ctrl-border);border-radius:var(--radius);font-family:inherit;font-size:14px;resize:vertical`;
    container.appendChild(ta);
    return {
      getHTML: () => ta.value,
      getRoot: () => ta,
      setContents: (html) => { ta.value = html; },
      enable: () => { ta.disabled = false; },
      disable: () => { ta.disabled = true; }
    };
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'ql-editor-wrap';
  container.appendChild(wrapper);

  const editorDiv = document.createElement('div');
  wrapper.appendChild(editorDiv);

  const quill = new Quill(editorDiv, {
    theme: 'snow',
    placeholder,
    modules: { toolbar: TOOLBAR_OPTIONS }
  });

  if (height) {
    editorDiv.querySelector('.ql-editor').style.minHeight = height;
  }

  return {
    getHTML: () => quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML,
    getRoot: () => quill.root,
    setContents: (html) => {
      if (html && html.trim()) {
        if (html.includes('<') && html.includes('>')) {
          quill.root.innerHTML = html;
        } else {
          quill.root.innerHTML = html;
        }
      }
    },
    enable: () => quill.enable(),
    disable: () => quill.disable(),
    quill
  };
}
