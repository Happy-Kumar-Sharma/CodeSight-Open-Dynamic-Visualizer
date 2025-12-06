
Thanks for wanting to contribute. This document is developer-focused: build instructions, architecture notes, how the `StateTranslator` works, how to extend the visualizer for new adapters (Python debugpy, cpptools), how to run tests and debug the extension host.

## Quick dev setup

Prerequisites

- Node.js LTS (14/16/18) and npm
- Visual Studio Code
- (Optional) Python or C/C++ extension for the debug adapters you want to test

Install & build

```powershell
cd "D:\Python Learnings\CodeSight-Dynamic-Visualizer"
npm install
npm run build
```


3. Launch the Extension Development Host

- Open this project folder in VS Code.
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


Watch mode while developing

```powershell
# in one terminal
npm run watch
# in another terminal you can run the extension host repeatedly (or reload)
```

## Debugging and diagnostics

- Open Developer Tools in the Extension Development Host: `Help -> Toggle Developer Tools`. Check the Console for extension logs.
- Use the visualizer Inspector's `Diagnostics` button to request recent raw DAP messages captured by the extension. This helps identify adapter-specific message formats.
- The extension logs `Posted to webview:` when it forwards a translated payload to the webview; look for that in the host console.

## Repository layout and key files

- `src/extension.ts` — VS Code extension entry point. Registers the command, creates the webview, and installs a `DebugAdapterTrackerFactory` to observe DAP messages and send follow-up requests (`stackTrace`, `scopes`, `variables`). Also captures recent raw DAP messages for diagnostics.
- `src/stateTranslator.ts` — The core translator that turns raw DAP `response` / `event` messages into a unified `model` (stack, scopes, heap nodes, references). This is intentionally conservative and stateful.
- `src/webview/*` — Webview UI: `visualizer.html`, `main.js`, `styles.css`. The UI is a D3-based renderer and an Inspector.
- `samples/` — sample scripts used for manual debugging (e.g. `test_armstrong_noinput.py`).

## How the translator works (overview)

The `StateTranslator` aggregates messages across a `stopped` cycle:

1. A `stopped` event arrives. The extension receives it and issues follow-up requests:
	 - `stackTrace` (for thread)
	 - `scopes` for the top frame
	 - `variables` for scopes (limited to avoid flooding)
2. The translator stores the returned frames, scopes, and variables keyed by `variablesReference`.
3. It builds heap nodes (synthetic `id`, `display`, `type`, `members`) from `variables` responses and attempts to detect pointer-like values (addresses matching `0x...`).
4. The translator then emits a `model` payload with `stack`, `scopes`, `heap` and `references` suitable for the D3 renderer.

### Extending the translator

- Adapter differences: Some adapters (like `debugpy` for Python) include additional fields (e.g. `evaluateName`, `presentationHint`) that are helpful. Inspect the Diagnostics output to identify fields you can use.
- Shape recognition:
	- Arrays: members with numeric names (`0`, `1`, `2`) — collapse into an array node and render as indexed cells.
	- Trees: detect `left`/`right` or `parent` member names and create a tree classification; emit a `tree` node type so the renderer can use a hierarchical layout.
	- Pointers: detect `0x...` values and create address nodes. For C, add `memory/readMemory` requests when the adapter supports them to extract raw memory.
- Add adapter-specific heuristics by detecting the debug adapter's `session.type` or by inspecting messages for adapter-specific fields. You can make the translator accept strategy modules that implement `canHandle(message)` and `translate(message, state)`.

## Webview & D3 notes

- `src/webview/main.js` assumes `d3` is available as a global (the extension injects the script into the webview HTML). For packaging, vendor D3 locally and update CSP.
- The renderer currently uses a force layout for generic graphs and renders arrays as indexed cells. To add tree layout, use `d3.hierarchy` and `d3.tree` for nodes classified as `tree`.
- The Inspector panel supports clicking a heap node to see members and follow references.

## Adding tests

- Add unit tests for translator functions by extracting pure translation logic into small functions and testing them with sample DAP message fixtures.
- Integrate a small test runner (e.g., `mocha` or `jest`) and add `npm test` to `package.json`.

## Coding conventions

- TypeScript with `strict` mode in `tsconfig.json`.
- Keep changes small and focused; the translator is sensitive to message shapes so tests are important.

## Packaging & publishing

- To publish a VSIX, build and use `vsce` or the `vsce` extension. Vendor third-party libraries (D3) to satisfy CSP and offline installs.

## Pull requests

- Open PRs against the default branch. Provide a clear description, a list of changed files, and sample diagnostics (if you changed translator logic).
- Add tests for translator behavior.

## Common troubleshooting

- No visualization: check that you're debugging inside the Extension Development Host, that the adapter returns `stackTrace`/`scopes`/`variables`, and use Diagnostics to inspect raw messages.
- Variables missing: try disabling `justMyCode` for Python, or use a `launch` configuration instead of `attach` for simpler adapter behavior.

## Need help?

Open an issue or paste the Diagnostics output here; include at least 4 consecutive `fromAdapter` messages captured by Diagnostics and I (or a maintainer) will adapt the translator to them.
