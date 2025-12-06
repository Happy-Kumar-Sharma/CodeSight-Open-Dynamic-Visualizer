(function () {
  const vscode = acquireVsCodeApi();

  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="layout">
      <div class="topbar">
        <div class="toolbar">CodeSight Dynamic Visualizer</div>
        <div class="legend">Stack | Heap | Pointers</div>
      </div>
      <div class="main">
        <div class="panel left">
          <h3>Call Stack</h3>
          <div class="stack-list" id="stack"></div>
          <h4>Scopes</h4>
          <div id="scopes"></div>
        </div>
        <div class="panel center">
          <h3>Heap / Memory Map</h3>
          <div class="heap-canvas" id="heapCanvas"></div>
          <div class="log" id="log"></div>
        </div>
        <div class="panel right">
          <h3>Inspector</h3>
          <div class="inspector" id="inspector">
            <div class="title">No selection</div>
            <div class="meta">Select a heap node to inspect details</div>
            <div class="members" id="inspectorMembers"></div>
            <div class="actions">
              <button class="btn" id="refreshBtn">Refresh</button>
              <button class="btn" id="diagnosticsBtn">Diagnostics</button>
              <button class="btn secondary" id="clearBtn">Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const logEl = document.getElementById('log');
  function log(msg) {
    const time = new Date().toLocaleTimeString();
    logEl.textContent = `${time} — ${msg}\n` + logEl.textContent;
  }

  // D3 SVG setup
  const canvas = d3.select('#heapCanvas');
  const width = Math.max(600, canvas.node().clientWidth || 800);
  const height = Math.max(400, canvas.node().clientHeight || 600);
  const svg = canvas.append('svg').attr('width', '100%').attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // defs for arrowheads
  svg.append('defs').html(`<marker id="arrow" viewBox="0 -5 10 10" refX="15" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="#60a5fa"></path></marker>`);

  let currentModel = null;

  function renderModel(model) {
    currentModel = model;
    log(`Rendering model: stack=${model.stack?.length || 0}, heap=${model.heap?.length || 0}`);

    renderStack(model.stack || []);
    renderScopes(model.scopes || []);

    if (!model.heap || model.heap.length === 0) {
      log('Model has no heap nodes — variables may be missing or adapter did not return variables responses. Use Diagnostics to inspect raw DAP messages.');
      // show an overlay message in the heap canvas
      svg.selectAll('*').filter(d=>true).remove();
      svg.append('text').attr('x', width/2).attr('y', height/2).attr('text-anchor','middle').attr('class','heap-text').attr('font-size',18).text('No heap nodes to display');
      return;
    }

    renderHeap(model.heap || [], model.references || []);
  }

  function renderStack(stack) {
    const el = document.getElementById('stack');
    el.innerHTML = '';
    stack.forEach((f, i) => {
      const d = document.createElement('div');
      d.className = 'frame' + (i === 0 ? ' active' : '');
      d.textContent = `${f.name} — ${f.source?.name || ''}:${f.line || ''}`;
      el.appendChild(d);
    });
  }

  function renderScopes(scopes) {
    const el = document.getElementById('scopes');
    el.innerHTML = '';
    scopes.forEach(s => {
      const d = document.createElement('div');
      d.className = 'frame';
      d.textContent = `${s.name} (varsRef=${s.variablesReference})`;
      el.appendChild(d);
    });
  }

  function renderHeap(heap, references) {
    svg.selectAll('*').filter(d=>true).remove();

    // simple layout: arrays horizontally, objects as boxes, addresses as small boxes
    const nodes = heap.map((h, i) => Object.assign({}, h, { _index: i }));

    // if a node looks like an array (members named as numeric indices), render as array
    nodes.forEach((n, i) => n.isArray = n.members && n.members.length > 0 && n.members.every(m => /^\d+$/.test(m.name)));

    // force layout for nodes
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.isArray ? 60 : 40))
      .stop();

    for (let i = 0; i < 120; ++i) simulation.tick();

    // draw nodes
    const g = svg.append('g').attr('class', 'nodes');

    const nodeG = g.selectAll('g.node').data(nodes, d => d.id).enter().append('g').attr('class', 'node').attr('transform', d => `translate(${d.x},${d.y})`);

    // arrays: draw series of cells
    nodeG.each(function (d) {
      const group = d3.select(this);
      if (d.isArray) {
        const cellW = 40; const cellH = 28;
        const totalW = Math.max(80, d.members.length * (cellW + 4));
        const startX = -totalW / 2;
        const rect = group.append('rect').attr('x', startX - 6).attr('y', -cellH).attr('width', totalW + 12).attr('height', cellH + 12).attr('class', 'heap-node');
        d.members.forEach((m, i) => {
          group.append('rect').attr('x', startX + i * (cellW + 4)).attr('y', -cellH / 2).attr('width', cellW).attr('height', cellH).attr('class', 'array-cell');
          group.append('text').attr('x', startX + i * (cellW + 4) + cellW / 2).attr('y', -cellH / 2 + 16).attr('text-anchor', 'middle').attr('class', 'heap-text').text(m.value || m.name);
        });
        group.append('text').attr('x', 0).attr('y', -cellH - 8).attr('text-anchor', 'middle').attr('class', 'heap-text').text(d.display);
      } else {
        group.append('rect').attr('x', -50).attr('y', -20).attr('width', 100).attr('height', 40).attr('class', 'heap-node');
        group.append('text').attr('x', 0).attr('y', 0).attr('text-anchor', 'middle').attr('class', 'heap-text').text(d.display);
      }
    });

    // create map of positions for references
    const posById = new Map();
    nodes.forEach(n => posById.set(n.id, { x: n.x, y: n.y }));

    // draw links (references)
    const links = references.map(r => ({ source: r.from, target: r.to, name: r.name }));
    const linkG = svg.append('g').attr('class', 'links');
    linkG.selectAll('path.link').data(links).enter().append('path')
      .attr('class', 'link')
      .attr('d', d => {
        const s = posById.get(d.source);
        const t = posById.get(d.target);
        if (!s || !t) return '';
        const dx = t.x - s.x; const dy = t.y - s.y; const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${s.x},${s.y} L ${t.x},${t.y}`;
      })
      .attr('stroke', '#60a5fa').attr('stroke-width', 1.5).attr('fill', 'none').attr('marker-end', 'url(#arrow)');

    // hover handlers to highlight
    nodeG.on('mouseenter', function (e, d) {
      d3.select(this).select('rect').attr('stroke', '#fbbf24').attr('stroke-width', 2);
    }).on('mouseleave', function (e, d) {
      d3.select(this).select('rect').attr('stroke', '#0ea5a4').attr('stroke-width', 1);
    });

    // click to inspect node
    nodeG.on('click', function (e, d) {
      e.stopPropagation();
      renderInspector(d);
    });
  }

  function renderInspector(node) {
    const title = document.querySelector('#inspector .title');
    const meta = document.querySelector('#inspector .meta');
    const membersEl = document.getElementById('inspectorMembers');
    if (!node) {
      title.textContent = 'No selection';
      meta.textContent = 'Select a heap node to inspect details';
      membersEl.innerHTML = '';
      return;
    }
    title.textContent = node.display || node.id;
    meta.textContent = `id: ${node.id}   type: ${node.type || 'unknown'}`;
    membersEl.innerHTML = '';
    (node.members || []).forEach(m => {
      const div = document.createElement('div');
      div.className = 'member';
      const left = document.createElement('div');
      left.textContent = m.name;
      const right = document.createElement('div');
      if (m.refId) {
        right.innerHTML = `<span class="ref">→ ${m.refId}</span>`;
        right.style.cursor = 'pointer';
        right.onclick = () => {
          // try to highlight referenced node if present
          const evt = new CustomEvent('inspectRef', { detail: m.refId });
          window.dispatchEvent(evt);
        };
      } else {
        right.innerHTML = `<span class="val">${String(m.value)}</span>`;
      }
      div.appendChild(left);
      div.appendChild(right);
      membersEl.appendChild(div);
    });
  }

  // handle inspectRef events to locate and highlight referenced node in SVG
  window.addEventListener('inspectRef', ev => {
    const refId = ev.detail;
    // find node g with data id === refId
    const all = svg.selectAll('g.node').filter(d => d.id === refId);
    if (!all.empty()) {
      all.each(function (d) {
        renderInspector(d);
        // briefly pulse
        d3.select(this).select('rect').transition().duration(120).attr('stroke', '#f97316').transition().duration(400).attr('stroke', '#0ea5a4');
      });
    } else {
      log('Referenced node not in view: ' + refId);
    }
  });

  // inspector buttons
  document.getElementById('refreshBtn').addEventListener('click', () => {
    if (currentModel) renderModel(currentModel);
  });
  document.getElementById('clearBtn').addEventListener('click', () => renderInspector(null));
  document.getElementById('diagnosticsBtn').addEventListener('click', () => {
    vscode.postMessage({ command: 'requestDiagnostics' });
  });

  window.addEventListener('message', event => {
    const message = event.data;
    if (!message) return;
    if (message.type === 'dapEvent') {
      const payload = message.payload;
      if (!payload) return;
      if (payload.kind === 'model') {
        renderModel(payload);
      } else {
        log('Unhandled payload kind=' + payload.kind);
      }
    } else if (message.type === 'diagnostics') {
      // display diagnostics in inspector members (raw messages)
      const membersEl = document.getElementById('inspectorMembers');
      membersEl.innerHTML = '';
      const payload = message.payload || [];
      payload.slice(-200).reverse().forEach((m, i) => {
        const el = document.createElement('div');
        el.className = 'member';
        const left = document.createElement('div');
        left.textContent = `${new Date(m.ts).toLocaleTimeString()} ${m.direction}`;
        const right = document.createElement('div');
        right.innerHTML = `<pre style="margin:0;white-space:pre-wrap;max-width:260px">${JSON.stringify(m.message, null, 2)}</pre>`;
        el.appendChild(left);
        el.appendChild(right);
        membersEl.appendChild(el);
      });
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    log('D3 Visualizer ready');
  });
})();
