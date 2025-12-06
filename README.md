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

**Developer testing (step‑by‑step)**

Follow these exact steps to test the extension locally as a developer:

1. Prerequisites

- Install Node.js (LTS) and npm.
- Use a recent VS Code build.

2. Prepare the project and build

```powershell
cd "D:\Python Learnings\CodeSight-Dynamic-Visualizer"
npm install
npm run build
```

3. Launch the Extension Development Host

- Open this folder in VS Code.
- Press `F5` (or use the `Run Extension` configuration). A new "Extension Development Host" window will open where the extension is loaded.

4. Run a debug session inside the host

- In the Extension Development Host window, open a small sample (or create `test.py` as shown below).
- Set a breakpoint and start debugging (Python/C/C++ depending on your sample). When the debug adapter hits the breakpoint the extension will receive a `stopped` event.

5. Open CodeSight Visualizer

- In the Extension Development Host, press `Ctrl+Shift+P` and run `CodeSight: Open Dynamic Visualizer`.
- The panel will listen for DAP events. After a `stopped` event the extension will automatically request `stackTrace`, `scopes`, and `variables` and populate the UI.

6. Inspect logs

- To debug the extension itself, open `Help -> Toggle Developer Tools` inside the Extension Development Host (not your regular VS Code window). Use the Console tab to view logs and warnings emitted by the extension and the webview.
- Also open `View -> Output` and choose `Log (Extension Host)` to see extension host logs.

7. Iteration loop

- After code changes run `npm run build`, then reload the Extension Development Host (press `Ctrl+R` in the host) or stop and press `F5` again.

Example: quick Python test

1. Create a file `test.py` in the Extension Development Host with the following contents:

```python
def f():
  x = [1,2,3]
  a = 10
  a += 1
  return x

if __name__ == '__main__':
  b = f()
  print(b)
```

2. Put a breakpoint on `a += 1`, start the Python debugger, then open `CodeSight: Open Dynamic Visualizer` to see the stack, scopes, and variables appear automatically.

Troubleshooting

- If data does not appear, ensure the debug adapter supports `stackTrace`, `scopes` and `variables` requests; some adapters expose limited capabilities.
- Check the Developer Tools console in the Extension Development Host for warnings such as `Follow-up DAP requests failed`.

Note: If your program uses `input()` it may block the debugger waiting for stdin and prevent hitting breakpoints or populating variables in some terminal configurations. Use the provided non-interactive sample instead to verify the visualizer quickly:

```powershell
# In the Extension Development Host open the folder and run the sample Python file
python samples/test_armstrong_noinput.py
```

Or create a launch configuration in the host that runs `samples/test_armstrong_noinput.py` with `console` set to `integratedTerminal`.

Quick troubleshooting checklist

- Confirm the extension is activated: run `CodeSight: Open Dynamic Visualizer` in the Extension Development Host (this activates the extension explicitly).
- Ensure you are debugging *inside the Extension Development Host window* (the host is the new VS Code window launched by `F5`). Set breakpoints there and confirm the editor shows the active, stopped line when the debugger hits a breakpoint.
- Open Developer Tools in the Extension Development Host (Help -> Toggle Developer Tools) and check the Console for lines like:
  - `Posted to webview: ...` — indicates the extension forwarded a unified payload to the webview.
  - `D3 Visualizer ready` and `Rendering model: ...` — emitted by the webview when it receives and renders a model.
- Open `View -> Output` and choose `Log (Extension Host)` to see any exception traces produced by the extension.
- For Python debugging: if variables do not appear, try disabling `justMyCode` in your debug configuration (set `"justMyCode": false`), or use the built-in `Python: Current File` launch so the adapter exposes locals and frames.
- For C/C++ debugging: ensure the adapter you use supports the DAP requests we need (`stackTrace`, `scopes`, `variables`). If you `attach` to a running process some adapters behave differently — try a simple `launch` configuration first.

If you still see nothing:

1. In the Extension Development Host Developer Tools Console, copy any relevant logs and paste them into a reply (I can analyze the messages and adapt the translator).
2. Optionally enable more verbose debug output by editing `src/extension.ts` to add additional `console.log` calls around `session.customRequest` calls — I can add an on-screen diagnostics button to dump the last N raw DAP messages into the webview for inspection.

If you'd like I can add that diagnostics button now so we can capture exactly what your debug adapter returns and why the model isn't being built.


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
