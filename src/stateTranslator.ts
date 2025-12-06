import * as vscode from 'vscode';

type VarItem = {
  name: string;
  value: string;
  type?: string;
  variablesReference?: number;
};

type HeapNode = {
  id: string; // typically variablesReference or address
  display: string;
  type?: string;
  members: Array<{ name: string; value?: string; refId?: string }>; 
};

// A stateful translator that aggregates stack/scopes/variables responses
// and emits a language-agnostic `model` object suitable for visualization.
export class StateTranslator {
  private lastStack: any[] = [];
  private lastScopes: any[] = [];
  private variablesByRef: Map<number, VarItem[]> = new Map();
  private heapNodes: Map<string, HeapNode> = new Map();

  translate(message: any, _session: vscode.DebugSession): any | null {
    if (!message) return null;

    const type = message.type || null;
    const event = message.event || null;

    // stopped event - note it and return a shallow stopped payload
    if ((type === 'event' && event === 'stopped') || (message.event === 'stopped')) {
      // Keep stopped signal but let follow-up responses build the model
      return {
        kind: 'stopped',
        reason: message.body?.reason || null,
        threadId: message.body?.threadId || message.threadId || null,
        timestamp: Date.now()
      };
    }

    // stackTrace response
    if (type === 'response' && message.command === 'stackTrace' && message.body) {
      const frames = message.body.stackFrames || [];
      this.lastStack = frames.map((f: any) => ({ id: f.id, name: f.name, line: f.line, source: f.source }));
      return this.buildModelUpdate();
    }

    // scopes response
    if (type === 'response' && message.command === 'scopes' && message.body) {
      const scopes = message.body.scopes || [];
      // store last scopes; frameId may be provided by the wrapper
      this.lastScopes = scopes.map((s: any) => ({ name: s.name, variablesReference: s.variablesReference, expensive: s.expensive }));
      return this.buildModelUpdate();
    }

    // variables response
    if (type === 'response' && message.command === 'variables' && message.body) {
      const vars: VarItem[] = (message.body.variables || []).map((v: any) => ({ name: v.name, value: v.value, type: v.type, variablesReference: v.variablesReference }));

      // If wrapper included variablesReference we can attribute these vars
      const parentRef = message.variablesReference || null;
      if (parentRef) {
        this.variablesByRef.set(parentRef, vars);
        // create/update a heap node for this reference
        const nodeId = String(parentRef);
        const display = message.scopeName || `obj@${nodeId}`;
        const node: HeapNode = { id: nodeId, display, type: message.type || undefined, members: [] };
        for (const v of vars) {
          if (v.variablesReference && v.variablesReference > 0) {
            node.members.push({ name: v.name, refId: String(v.variablesReference) });
          } else {
            node.members.push({ name: v.name, value: v.value });
          }
          // detect addresses like 0x7ff... inside value and create pointer nodes
          const addr = this.extractAddress(v.value);
          if (addr) {
            // create a synthetic heap node for the address if not present
            if (!this.heapNodes.has(addr)) {
              this.heapNodes.set(addr, { id: addr, display: addr, type: 'address', members: [] });
            }
            // also record a member pointing to that address
          }
        }
        this.heapNodes.set(nodeId, node);
      }

      // store variables even if parentRef not provided (some adapters inline)
      // we also try to create heap nodes for any top-level composite values
      return this.buildModelUpdate();
    }

    // Other events/responses: ignore for now
    return null;
  }

  private extractAddress(val?: string): string | null {
    if (!val) return null;
    const m = String(val).match(/0x[0-9a-fA-F]+/);
    return m ? m[0] : null;
  }

  private buildModelUpdate() {
    // Build heap list from variablesByRef and heapNodes
    const heap: HeapNode[] = [];
    // include heapNodes first
    for (const node of Array.from(this.heapNodes.values())) heap.push(node);

    // include variablesByRef as nodes
    for (const [ref, vars] of Array.from(this.variablesByRef.entries())) {
      const id = String(ref);
      if (!this.heapNodes.has(id)) {
        const members = vars.map(v => v.variablesReference && v.variablesReference > 0 ? { name: v.name, refId: String(v.variablesReference) } : { name: v.name, value: v.value });
        heap.push({ id, display: `obj@${id}`, type: vars[0]?.type, members });
      }
    }

    // Build references (stack variables → heap)
    const refs: Array<{ from: string; to: string; name?: string }> = [];
    // Attempt to find references in scopes: assume top-level scopes were queried and variablesByRef filled
    for (const [ref, vars] of Array.from(this.variablesByRef.entries())) {
      for (const v of vars) {
        if (v.variablesReference && v.variablesReference > 0) {
          refs.push({ from: `obj@${ref}`, to: String(v.variablesReference), name: v.name });
        } else {
          const addr = this.extractAddress(v.value);
          if (addr) refs.push({ from: `obj@${ref}`, to: addr, name: v.name });
        }
      }
    }

    const model = {
      kind: 'model',
      stack: this.lastStack,
      scopes: this.lastScopes,
      heap,
      references: refs,
      timestamp: Date.now()
    };

    return model;
  }
}
