import { h, nav, copyText } from '../dom.js';
import { COPY, UI } from '../../copy.js';
import { CONFIG } from '../../config.js';
import { openSheet } from '../toast.js';
import { exportText, exportFileName } from '../../core/backup.js';
import { mdLabel, dayOfMs } from '../../core/date.js';

export function render(app) {
  const store = app.store, cfg = CONFIG;
  const lastLine = h('p', { class: 'note' });
  const paintLast = () => { const t = store.db.settings.lastExportAt; lastLine.textContent = t ? `마지막으로 내보낸 날 ${mdLabel(dayOfMs(t))}` : UI.neverExported; };
  const textOut = h('textarea', { class: 'inp', rows: '5', readonly: true, hidden: true, 'aria-label': '내보내기 글자' });
  const result = h('p', { class: 'note result', role: 'status' });
  const stamp = () => { store.update((d) => { d.settings.lastExportAt = app.now(); }); paintLast(); };

  function x2(onOk) {
    openSheet(app, (panel, close) => {
      panel.append(h('div', { class: 'sheet-t' }, COPY.X2.map((t) => h('p', { text: t }))),
        h('button', { class: 'cta', type: 'button', text: '내보내기', onclick: () => { close(); onOk(); } }),
        h('button', { class: 'tbtn', type: 'button', text: '취소', onclick: close }));
    });
  }
  async function exportFile() {
    const text = exportText(store.db, app.now(), app.build);
    const name = exportFileName(app.today());
    const file = new File([text], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        stamp(); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try {
      const url = URL.createObjectURL(file);
      const a = h('a', { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      stamp(); return;
    } catch { /* 글자로 보여 주기로 */ }
    textOut.value = text; textOut.hidden = false; textOut.focus(); textOut.select();
  }
  const exportBtn = h('button', { class: 'cta', type: 'button', text: '파일로 내보내기', onclick: () => x2(exportFile) });
  const copyBtn = h('button', { class: 'tbtn', type: 'button', text: '글자로 복사', onclick: () => x2(() => {
    const text = exportText(store.db, app.now(), app.build);
    textOut.value = text;
    copyText(text, textOut).then((ok) => { if (ok) { stamp(); result.textContent = UI.copied; } else { textOut.hidden = false; textOut.focus(); textOut.select(); result.textContent = UI.copyFail; } });
  }) });

  let pending = null;
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  const fileName = h('p', { class: 'note' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    if (f.size > cfg.MAX_IMPORT_BYTES) { pending = null; result.textContent = UI.importErr.size; return; }
    try { pending = await f.text(); fileName.textContent = UI.fileRead; result.textContent = ''; } catch { pending = null; result.textContent = UI.importErr.json; }
  });
  const paste = h('textarea', { class: 'inp', rows: '4', placeholder: '내보낸 글자를 여기에 붙여넣기', 'aria-label': '불러올 글자' });
  const importBtn = h('button', { class: 'tbtn', type: 'button', text: '불러오기', onclick: () => {
    const text = pending || paste.value;
    if (!text.trim()) { result.textContent = UI.importEmpty; return; }
    openSheet(app, (panel, close) => {
      panel.append(h('div', { class: 'sheet-t' }, h('p', { text: UI.importAsk })),
        h('button', { class: 'cta', type: 'button', text: '바꾸기', onclick: () => {
          close();
          const r = store.importReplace(text);
          if (!r.ok) { result.textContent = UI.importErr[r.code] || UI.importErr.format; return; }
          pending = null; paste.value = ''; fileName.textContent = '';
          app.applyMotion();
          result.textContent = `사람 ${r.counts.people} · 건 ${r.counts.entries}`;
          app.toast.show(UI.imported, { ms: cfg.UNDO_SEC * 1000, undo: () => { store.undo(); app.applyMotion(); result.textContent = ''; } });
        } }),
        h('button', { class: 'tbtn', type: 'button', text: '취소', onclick: close }));
    });
  } });
  paintLast();
  return h('div', { class: 'page backup' }, nav(app), h('div', { class: 'ttl' }, h('h1', { text: '내보내기·불러오기' })),
    h('section', { class: 'b-sec' }, lastLine, exportBtn, h('div', { class: 'b-row' }, copyBtn), textOut),
    h('section', { class: 'b-sec' }, h('p', { class: 'lab', text: '불러오기' }),
      h('div', { class: 'b-row' }, h('button', { class: 'tbtn', type: 'button', text: '파일 고르기', onclick: () => fileInput.click() }), fileInput), fileName, paste, h('div', { class: 'b-row' }, importBtn)),
    result, h('p', { class: 'note x1', text: COPY.X1 }));
}
