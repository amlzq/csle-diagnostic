/**
 * 自定义词典管理面板的页面。所有文案由扩展通过 state 消息传入（已本地化），
 * 页面用 textContent/value 渲染，不拼接 innerHTML，避免词条内容被当作 HTML。
 */
export function buildPanelHtml(nonce: string, cspSource: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${nonce}">
body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 16px 24px; }
h2 { margin: 0 0 4px; font-weight: 600; }
.muted { color: var(--vscode-descriptionForeground); word-break: break-all; margin-bottom: 12px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.toolbar input { flex: 1; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { text-align: left; padding: 4px 6px; color: var(--vscode-descriptionForeground); font-weight: 600; }
td { padding: 3px 6px; }
th.action, td.action { width: 80px; }
input { width: 100%; box-sizing: border-box; padding: 4px 6px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); }
input:focus { outline: 1px solid var(--vscode-focusBorder); }
button { padding: 4px 10px; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: none; cursor: pointer; }
button:hover { background: var(--vscode-button-secondaryHoverBackground); }
button.primary { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
button.primary:hover { background: var(--vscode-button-hoverBackground); }
#error { min-height: 1.4em; margin-top: 10px; color: var(--vscode-errorForeground); }
#empty { margin: 12px 6px; color: var(--vscode-descriptionForeground); }
tfoot td { padding-top: 10px; }
</style>
</head>
<body>
<h2 id="title"></h2>
<div class="muted" id="file"></div>
<div class="toolbar">
  <input id="search" type="text">
  <button id="import"></button>
  <button id="open"></button>
</div>
<table>
  <thead><tr><th id="thFrom"></th><th id="thTo"></th><th class="action"></th></tr></thead>
  <tbody id="rows"></tbody>
  <tfoot><tr>
    <td><input id="newFrom" type="text"></td>
    <td><input id="newTo" type="text"></td>
    <td class="action"><button id="add" class="primary"></button></td>
  </tr></tfoot>
</table>
<div id="empty"></div>
<div id="error" role="alert"></div>
<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const $ = id => document.getElementById(id);
  let state = null;

  function post(message) { vscode.postMessage(message); }

  function render() {
    if (!state) { return; }
    const L = state.labels;
    $('title').textContent = L.title;
    $('file').textContent = L.glyph + ' · ' + state.file;
    $('search').placeholder = L.search;
    $('import').textContent = L.import;
    $('open').textContent = L.openFile;
    $('thFrom').textContent = L.from;
    $('thTo').textContent = L.to;
    $('newFrom').placeholder = L.from;
    $('newTo').placeholder = L.to;
    $('add').textContent = L.add;
    $('error').textContent = state.error || '';

    const query = $('search').value.trim().toLowerCase();
    const rows = $('rows');
    rows.textContent = '';
    let shown = 0;
    for (const [source, target] of state.entries) {
      if (query && !(source.toLowerCase().includes(query) || target.toLowerCase().includes(query))) { continue; }
      shown++;
      const tr = document.createElement('tr');
      const fromInput = document.createElement('input');
      const toInput = document.createElement('input');
      fromInput.value = source;
      toInput.value = target;
      const commit = () => {
        if (fromInput.value === source && toInput.value === target) { return; }
        post({ type: 'save', oldSource: source, source: fromInput.value, target: toInput.value });
      };
      fromInput.addEventListener('change', commit);
      toInput.addEventListener('change', commit);
      for (const input of [fromInput, toInput]) {
        input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value = input === fromInput ? source : target; } });
        const td = document.createElement('td');
        td.appendChild(input);
        tr.appendChild(td);
      }
      const actionTd = document.createElement('td');
      actionTd.className = 'action';
      const del = document.createElement('button');
      del.textContent = L.delete;
      del.addEventListener('click', () => post({ type: 'delete', source }));
      actionTd.appendChild(del);
      tr.appendChild(actionTd);
      rows.appendChild(tr);
    }
    $('empty').textContent = shown === 0 ? L.empty : '';
  }

  function add() {
    post({ type: 'save', source: $('newFrom').value, target: $('newTo').value });
  }

  $('add').addEventListener('click', add);
  for (const id of ['newFrom', 'newTo']) {
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { add(); } });
  }
  $('search').addEventListener('input', render);
  $('import').addEventListener('click', () => post({ type: 'import' }));
  $('open').addEventListener('click', () => post({ type: 'openFile' }));

  window.addEventListener('message', event => {
    const message = event.data;
    if (message.type === 'state') {
      state = message;
      if (message.saved) { $('newFrom').value = ''; $('newTo').value = ''; $('newFrom').focus(); }
      render();
    } else if (message.type === 'error' && state) {
      state.error = message.message;
      $('error').textContent = message.message;
    }
  });

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
