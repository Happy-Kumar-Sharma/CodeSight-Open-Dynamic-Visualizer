(function () {
  const vscode = acquireVsCodeApi();

  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="toolbar">CodeSight Dynamic Visualizer</div>
    <div class="container">
      <div class="panel" id="stackPanel">
        <h3>Call Stack</h3>
        <div id="stack"></div>
      </div>
      <div class="panel" id="heapPanel">
        <h3>Heap / Memory Map</h3>
        <div id="heap"></div>
      </div>
    </div>
    <div class="log" id="log"></div>
  `;

  function log(msg) {
    const l = document.getElementById('log');
    const time = new Date().toLocaleTimeString();
    l.textContent = `${time} — ${msg}\n` + l.textContent;
  }

  function renderStopped(model) {
    const stackEl = document.getElementById('stack');
    stackEl.innerHTML = '';
    const f = document.createElement('div');
    f.className = 'frame active';
    f.textContent = `Stopped: ${model.reason || 'unknown'}`;
    stackEl.appendChild(f);
  }

  function renderScopes(model) {
    const stackEl = document.getElementById('stack');
    stackEl.innerHTML = '';
    (model.scopes || []).forEach(scope => {
      const s = document.createElement('div');
      s.className = 'scope';
      s.innerHTML = `<strong>${scope.name}</strong>`;
      stackEl.appendChild(s);
    });
  }

  function renderVariables(model) {
    const heapEl = document.getElementById('heap');
    heapEl.innerHTML = '';
    const vars = model.variables || [];
    vars.forEach(v => {
      const d = document.createElement('div');
      d.className = 'var';
      const name = document.createElement('div');
      name.className = 'var-name';
      name.textContent = v.name;
      const value = document.createElement('div');
      value.className = 'var-value';
      value.textContent = String(v.value);
      d.appendChild(name);
      d.appendChild(value);
      heapEl.appendChild(d);
    });
  }

  function renderStackTrace(model) {
    const stackEl = document.getElementById('stack');
    stackEl.innerHTML = '';
    (model.stackFrames || []).forEach(frame => {
      const f = document.createElement('div');
      f.className = 'frame';
      f.textContent = `${frame.name} — ${frame.line || frame.source?.name || ''}`;
      stackEl.appendChild(f);
    });
  }

  window.addEventListener('message', event => {
    const message = event.data;
    if (!message) return;
    if (message.type === 'dapEvent') {
      const payload = message.payload;
      log(`Received dapEvent kind=${payload?.kind}`);
      switch (payload.kind) {
        case 'stopped':
          renderStopped(payload);
          break;
        case 'scopes':
          renderScopes(payload);
          break;
        case 'variables':
          renderVariables(payload);
          break;
        case 'stackTrace':
          renderStackTrace(payload);
          break;
        default:
          log('Unhandled payload: ' + JSON.stringify(payload).slice(0, 200));
      }
    }
  });

  // expose a simple ping for debugging
  window.addEventListener('DOMContentLoaded', () => {
    log('Visualizer ready');
  });
})();
