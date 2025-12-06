# CodeSight Dynamic Visualizer

CodeSight Dynamic Visualizer is a prototype VS Code extension that non-invasively listens to the Debug Adapter Protocol (DAP) and draws a live, interactive visualization of program state in a side panel. It helps learners and developers inspect the call stack, heap/objects, arrays and pointer-like references while stepping through code.

Status: Prototype. This repository provides a developer scaffold and a working visualizer for common debug adapters. The translator heuristics are intentionally conservative; see `CONTRIBUTING.md` for developer instructions to extend support for specific adapters and richer language features.

---

Quick start (user)

Prerequisites

- Visual Studio Code
- Language debugger extension (Python, C/C++ recommended)


In your VS Code

- Open a C/Python file or your project.
- Start debugging (debug and run) and hit a breakpoint.
- Run the command `CodeSight: Open Dynamic Visualizer` from the Command Palette (Ctrl + Shift + P).
- Search for `CodeSight Dynamic Visualizer` and select this extention.

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

UI overview

- Left: Call stack and scopes
- Center: Heap / Memory canvas with objects, arrays, and arrowed references
- Right: Inspector — click any heap node to view members and follow references

If visualization is empty

- Open Inspector → Diagnostics to see raw DAP messages captured by the extension. Diagnostics shows messages exchanged with the adapter; use them to confirm the adapter returned `stackTrace`, `scopes` and `variables` responses.
- If your program uses `input()`, it may block. Use the non-interactive sample `samples/test_armstrong_noinput.py` to verify the visualizer.

Limitations

- Not all debug adapters provide the same DAP responses. The translator maps common shapes to a unified model; adapter-specific tweaks are sometimes required for rich representations.
- For low-level pointer decoding and memory layout (C/C++), production work requires adapter-specific memory reads, symbol parsing and heuristics.

Want to contribute or develop?

See `CONTRIBUTING.md` for detailed developer setup, architecture notes, extending the `StateTranslator`, running tests and debugging the extension.

---

**License**

License: MIT

**Contributing**

This starter scaffold is under permissive terms. If you'd like help building specific features (C pointer resolution, Python object layout decoding, tree auto-layout algorithms), open an issue or PR with the feature focus.
