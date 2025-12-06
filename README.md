# CodeSight Dynamic Visualizer

CodeSight Dynamic Visualizer is a VS Code extension prototype that non-invasively listens to the VS Code Debug Adapter Protocol (DAP) and renders a live, interactive visualization of program state (call stack, heap/memory, pointers/references, and structured data) in a side panel.

This repository contains a scaffolding and working skeleton demonstrating how to:
- Attach a Debug Adapter Tracker to receive DAP messages.
- Translate DAP messages into a unified JSON model.
- Render that model in a WebView UI with a clear Stack and Heap layout.

This project focuses on an architecture suitable for both C/C++ and Python debugging adapters.

**Status:** Prototype scaffolding (skeleton translator + webview). Extend for production use.

---

**Quick Start (development)**

1. Install dependencies:

```powershell
cd "D:\Python Learnings\CodeSight-Dynamic-Visualizer"
npm install
```

2. Build the extension:

```powershell
npm run build
```

3. Launch the extension in a new Extension Development Host (VS Code):
- Open this folder in VS Code
- Press `F5` or run the `Run Extension` launch configuration

4. In the Extension Development Host, run or attach a debugger (Python/C/C++) and then run the command `CodeSight: Open Dynamic Visualizer` from the Command Palette.

---

**Architecture**

- `src/extension.ts` — Extension entry. Registers the `codesight.start` command, creates the WebView panel, and registers a `DebugAdapterTrackerFactory` to observe DAP traffic.
- `src/stateTranslator.ts` — A conservative translator that converts DAP events/responses into a small unified model. Extend this to decode pointers, memory areas, and language-specific object graphs.
- `src/webview/*` — WebView assets: `visualizer.html`, `main.js`, and `styles.css`. The UI demonstrates rendering of stack frames and variables.

**Core Concepts**

- Non-invasive: we do not modify user source. All data originates from the debug adapter (DAP). The extension observes messages and issues follow-up requests if needed (e.g. to request variables, memory) — this scaffold does not yet send requests, but it receives responses when adapters provide them.

- StateTranslator: central place to add heuristics for:
  - Resolving memory addresses to types (C) and object layouts (Python).
  - Recognizing lists, arrays, linked nodes, trees, and mapping them to a graph model for visualization.

- WebView visualization: a responsive UI that can be replaced with a D3.js or Canvas-based renderer for more complex layouts, animations and pointer-arrow drawing.

---

**Next Steps & TODO**

- Implement active `variables` / `scopes`/`stackTrace` requests after a `stopped` event to populate the model.
- Build richer heuristics in `StateTranslator` to classify memory blocks, object headers (Python), and pointer chains (C).
- Implement a drawing engine (D3/Canvas/SVG) to render pointers as arrows between nodes and an interactive memory map with zoom/pan.
- Add tests and CI (lint, typecheck, build validation).

---

**Contributing**

This starter scaffold is under permissive terms. If you'd like help building specific features (C pointer resolution, Python object layout decoding, tree auto-layout algorithms), open an issue or PR with the feature focus.

**License**

MIT
